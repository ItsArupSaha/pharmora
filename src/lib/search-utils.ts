/**
 * Search ranking for medicine/item lists.
 * Pure scoring over title/group/company text: exact beats prefix beats
 * substring beats typo-tolerant (Damerau) beats phonetic-only. All tiers are
 * graded so closer typos sort before distant ones.
 */
import {
  normalizePhonetic,
  getLevenshteinDistance,
  typoDistance,
} from './string-similarity';

// Re-exported for existing callers.
export { normalizePhonetic, getLevenshteinDistance };

/**
 * Canonical identity key for a customer/shop name: case- and spacing-
 * insensitive. Two names with the same key are the same shop — this drives
 * the "one shop name cannot be registered twice" rule everywhere customers
 * are created or matched.
 */
export function normalizeCustomerKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const splitWords = (s: string): string[] => s.toLowerCase().trim().split(/[\s\-,.]+/).filter(Boolean);

/**
 * True when target matches query via substring, phonetic equivalence, or a
 * tolerated typo (edit distance within limits) on any word.
 */
export function isFuzzyMatch(target: string | null | undefined, query: string): boolean {
  if (!target || !query) return false;

  const targetLower = target.toLowerCase().trim();
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return false;

  // 1. Direct substring
  if (targetLower.includes(queryLower)) return true;

  // 2. Phonetic normalized substring (transliteration drift)
  if (normalizePhonetic(targetLower).includes(normalizePhonetic(queryLower))) return true;

  // 3. Typo tolerance per word, raw and phonetic
  const targetWords = splitWords(targetLower);
  const normTargetWords = targetWords.map(normalizePhonetic);
  for (const qWord of splitWords(queryLower)) {
    const normQWord = normalizePhonetic(qWord);
    for (let i = 0; i < targetWords.length; i++) {
      if (typoDistance(qWord, targetWords[i]) !== null) return true;
      if (typoDistance(normQWord, normTargetWords[i]) !== null) return true;
    }
  }

  return false;
}

/**
 * Categorizes item form factor for priority listing:
 * 1 = Tablets & Capsules, 2 = Suspensions & Syrups, 3 = Creams & Ointments,
 * 4 = Injections, 5 = Others.
 */
export function getFormFactorRank(title: string | null | undefined): number {
  if (!title) return 5;
  const t = title.toLowerCase();

  if (/\b(tab|tablets?|cap|capsules?)\b/i.test(t)) return 1;
  if (/\b(syr|syrups?|syp|susp|suspensions?|drop|drops|sol|solutions?|liq|liquids?)\b/i.test(t)) return 2;
  if (/\b(cream|creams?|oint|ointments?|gel|gels?)\b/i.test(t)) return 3;
  if (/\b(inj|injections?|infusion|infusions?|vial|ampoule|ampoules?)\b/i.test(t)) return 4;
  return 5;
}

/**
 * Best typo/phonetic grade for a query against one field's words.
 * Returns a small penalty (smaller = closer) or null when nothing matches.
 */
function gradedFuzzyPenalty(queryLower: string, field: string | null | undefined): number | null {
  if (!field) return null;

  let bestRaw: number | null = null;
  let bestPhonetic: number | null = null;

  const fieldWords = splitWords(field);
  const normFieldWords = fieldWords.map(normalizePhonetic);
  for (const qWord of splitWords(queryLower)) {
    const normQWord = normalizePhonetic(qWord);
    for (let i = 0; i < fieldWords.length; i++) {
      const raw = typoDistance(qWord, fieldWords[i]);
      if (raw !== null && (bestRaw === null || raw < bestRaw)) bestRaw = raw;

      const phon = typoDistance(normQWord, normFieldWords[i]);
      if (phon !== null && (bestPhonetic === null || phon < bestPhonetic)) bestPhonetic = phon;
    }
  }

  if (bestRaw !== null) return bestRaw * 0.05;        // 0.05 / 0.10
  if (bestPhonetic !== null) return 0.2 + bestPhonetic * 0.05; // 0.25 / 0.30
  return null;
}

/**
 * Search relevance score for an item against a query. Lower = better.
 * Coarse tiers 1–7 as before; typo tiers are graded (8.x title, 9.x
 * group/company) so closer spellings rank ahead of distant ones.
 */
export function getSearchMatchRank(
  title: string | null | undefined,
  query: string,
  group?: string | null,
  company?: string | null
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const t = (title || '').trim().toLowerCase();
  const g = (group || '').trim().toLowerCase();
  const c = (company || '').trim().toLowerCase();

  // 1. Exact match on any field
  if (t === q || g === q || c === q) return 1;

  // 2. Title starts with query
  if (t.startsWith(q)) return 2;

  // 3. Title word starts with query
  const tWords = splitWords(t);
  if (tWords.some((w) => w.startsWith(q))) return 3;

  // 4. Group or company starts with query
  if (g.startsWith(q) || c.startsWith(q)) return 4;

  // 5. Group or company word starts with query
  const gWords = splitWords(g);
  const cWords = splitWords(c);
  if (gWords.some((w) => w.startsWith(q)) || cWords.some((w) => w.startsWith(q))) return 5;

  // 6. Title contains query
  if (t.includes(q)) return 6;

  // 7. Group or company contains query
  if (g.includes(q) || c.includes(q)) return 7;

  // 8. Graded typo match on title
  const titlePenalty = gradedFuzzyPenalty(q, t);
  if (titlePenalty !== null) return 8 + titlePenalty;

  // 9. Graded typo match on group or company
  const metaPenalty = gradedFuzzyPenalty(q, g) ?? gradedFuzzyPenalty(q, c);
  if (metaPenalty !== null) return 8.35 + metaPenalty;

  return 10;
}

/**
 * Compares two items during search: match relevance first, then form factor
 * (tablets before syrups), then the active sortBy with sensible fallbacks.
 */
export function compareItemsForSearch<T extends { title: string; medicineGroup?: string; company?: string; stock?: number; expiryDate?: string }>(
  a: T,
  b: T,
  query: string,
  sortBy: string = 'title-asc'
): number {
  const matchA = getSearchMatchRank(a.title, query, a.medicineGroup, a.company);
  const matchB = getSearchMatchRank(b.title, query, b.medicineGroup, b.company);

  if (matchA !== matchB) return matchA - matchB;

  const formA = getFormFactorRank(a.title);
  const formB = getFormFactorRank(b.title);
  if (formA !== formB) return formA - formB;

  if (sortBy === 'title-desc') return (b.title || '').localeCompare(a.title || '');
  if (sortBy === 'stock-asc') return (a.stock || 0) - (b.stock || 0);
  if (sortBy === 'stock-desc') return (b.stock || 0) - (a.stock || 0);
  if (sortBy === 'group-asc') {
    const groupCmp = (a.medicineGroup || '').localeCompare(b.medicineGroup || '');
    if (groupCmp !== 0) return groupCmp;
  }
  if (sortBy === 'company-asc') {
    const companyCmp = (a.company || '').localeCompare(b.company || '');
    if (companyCmp !== 0) return companyCmp;
  }
  if (sortBy === 'expiry-asc') {
    const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
  }

  const titleCmp = (a.title || '').localeCompare(b.title || '');
  if (titleCmp !== 0) return titleCmp;

  const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
  const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
  if (dateA !== dateB) return dateA - dateB;

  return (b.stock || 0) - (a.stock || 0);
}
