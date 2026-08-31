import { describe, it, expect } from 'vitest';
import { isFuzzyMatch, compareItemsForSearch } from '../search-utils';
import type { Item } from '../types';

const SAMPLE_ITEMS: Item[] = [
  {
    id: '1',
    title: 'Napa 500mg Tablet',
    categoryName: 'Tablet',
    categoryId: 'cat-tab',
    medicineGroup: 'Paracetamol',
    company: 'Beximco',
    location: 'Shelf-A1',
    stock: 25,
    sellingPrice: 10,
    productionPrice: 8,
    isSalable: true,
  },
  {
    id: '2',
    title: 'Napa Extra Tablet',
    categoryName: 'Tablet',
    categoryId: 'cat-tab',
    medicineGroup: 'Paracetamol + Caffeine',
    company: 'Beximco',
    location: 'Shelf-A2',
    stock: 2,
    sellingPrice: 15,
    productionPrice: 12,
    isSalable: true,
  },
  {
    id: '3',
    title: 'Alcet 10mg Tablet',
    categoryName: 'Tablet',
    categoryId: 'cat-tab',
    medicineGroup: 'Cetirizine',
    company: 'Square',
    location: 'Shelf-B1',
    stock: 50,
    sellingPrice: 5,
    productionPrice: 3.5,
    isSalable: true,
  },
  {
    id: '4',
    title: 'Ace Plus Syrup',
    categoryName: 'Syrup',
    categoryId: 'cat-syr',
    medicineGroup: 'Paracetamol',
    company: 'Square',
    location: 'Shelf-C3',
    stock: 12,
    sellingPrice: 35,
    productionPrice: 28,
    isSalable: true,
  },
];

function filterItems(items: Item[], query: string): Item[] {
  if (!query.trim()) return items;
  const q = query.trim();
  const qLower = q.toLowerCase();

  return items
    .filter(
      (item) =>
        (item.title || '').toLowerCase().includes(qLower) ||
        (item.categoryName || '').toLowerCase().includes(qLower) ||
        (item.medicineGroup && item.medicineGroup.toLowerCase().includes(qLower)) ||
        (item.company && item.company.toLowerCase().includes(qLower)) ||
        (item.location && item.location.toLowerCase().includes(qLower)) ||
        isFuzzyMatch(item.title, q) ||
        isFuzzyMatch(item.categoryName, q) ||
        (item.medicineGroup && isFuzzyMatch(item.medicineGroup, q)) ||
        (item.company && isFuzzyMatch(item.company, q))
    )
    .sort((a, b) => compareItemsForSearch(a, b, q));
}

describe('Item Filter & Search Verification', () => {
  it('finds items with typo even in a list with mixed names', () => {
    const results = filterItems(SAMPLE_ITEMS, 'alset');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Alcet 10mg Tablet');
  });

  it('searches across rack/shelf location', () => {
    const results = filterItems(SAMPLE_ITEMS, 'Shelf-C3');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Ace Plus Syrup');
  });

  it('finds all medicines belonging to a generic group', () => {
    const results = filterItems(SAMPLE_ITEMS, 'Paracetamol');
    const titles = results.map((i) => i.title);
    expect(titles).toContain('Napa 500mg Tablet');
    expect(titles).toContain('Napa Extra Tablet');
    expect(titles).toContain('Ace Plus Syrup');
    expect(titles).not.toContain('Alcet 10mg Tablet');
  });

  it('finds all medicines belonging to a company', () => {
    const results = filterItems(SAMPLE_ITEMS, 'Square');
    const titles = results.map((i) => i.title);
    expect(titles).toContain('Alcet 10mg Tablet');
    expect(titles).toContain('Ace Plus Syrup');
    expect(titles).not.toContain('Napa 500mg Tablet');
  });

  it('handles empty/undefined fields gracefully without breaking', () => {
    const incompleteItems: Item[] = [
      {
        id: '99',
        title: 'Generic Sample',
        categoryName: 'General',
        categoryId: 'c1',
        stock: 0,
        sellingPrice: 0,
        productionPrice: 0,
        isSalable: true,
      },
    ];
    const results = filterItems(incompleteItems, 'sample');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('99');
  });
});
