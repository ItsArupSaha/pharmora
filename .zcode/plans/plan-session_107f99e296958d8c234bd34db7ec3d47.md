# Business Type Selection: Pharmacy vs General Business

## Core design
- Reuse the already-declared-but-dead `storeType` field on `AuthUser` (`src/lib/types.ts:47`), narrowed to `'pharmacy' | 'general'`.
- **Existing users: zero migration, zero change.** `normalizeAuthUser` (`src/hooks/use-auth.tsx:30-36`) adds `storeType: data.storeType ?? 'pharmacy'` — absent field = pharmacy, so every current user's UI renders byte-identical (all conditionals take the pharmacy branch) with no extra Firestore reads (field rides the existing user-doc snapshot).
- **New users** pick the type as step 1 of the existing `/onboarding` wizard (the `onboardingComplete === false` gate already forces every first-time non-admin there — no new gating logic).
- **General business** = hide generic-group UI + the pharmacy-exclusive "Alternatives" feature + neutralize pharmacy copy. Expiry/batch/shelf stay (generic retail features) — only their wording neutralizes. All hides follow the established hide-not-remove pattern (fields stay in zod schemas + form state, so data round-trips untouched).
- **appMode (normal/stock) and storeType stay orthogonal** — a general business can also use stock-only mode.

## Phase 1 — Type + defaults
1. `src/lib/types.ts` — export `type StoreType = 'pharmacy' | 'general'`; change `storeType?: StoreType` (drop the speculative `'bookstore'`; field is dead so safe).
2. `src/hooks/use-auth.tsx` `normalizeAuthUser` — default `storeType` to `'pharmacy'`.
3. New `src/hooks/use-store-type.ts` — `useStoreType()` → `{ storeType, isPharmacy, isGeneral }`; single source of truth instead of scattered `=== 'general'` checks.

## Phase 2 — Onboarding step 1
4. New `src/components/onboarding/business-type-cards.tsx` — two cards ("Pharmacy" / "General Business Management"), mirroring `mode-selection-cards.tsx` styling/structure.
5. `src/app/onboarding/page.tsx` — holds step state: step 1 = business type cards (writes `storeType` form value, then Continue), step 2 = existing details form. Add `storeType` to `src/app/onboarding/schema.ts` (`z.enum`, required).
6. `src/components/onboarding/onboarding-form.tsx` — conditional labels/placeholders: "Pharmacy Name / e.g., MediCare Pharmacy" → "Business Name / e.g., My Store" for general.
7. `src/hooks/use-onboarding.ts` + `src/lib/db/database.ts` `completeOnboarding` — persist `storeType`; pass it to `initializeDefaultCategories`.
8. `src/lib/db/categories.ts` `initializeDefaultCategories(userId, storeType)` — pharmacy keeps Medicines/Surgicals/General Products; general seeds a single "General Products".

## Phase 3 — Hide generic groups for general business
All conditional on `isGeneral`; pharmacy rendering untouched; schemas/search/sort logic untouched (group matching is a no-op on empty strings — keeps all 104 tests green and avoids perf risk):

9. `purchase-item-medicine-fields.tsx` — new `showGroup?: boolean` prop (default `true`) wrapping only the `medicineGroup` input; **expiry input always stays** (generic). Precedent: `SupplierFormFields.showLocation`.
10. `purchase-item-row.tsx` — accept/pass `showGroup` (parents compute: purchase page and `add-items-dialog.tsx`).
11. `items-table.tsx` — `showGeneric` becomes `!isStockMode && isPharmacy` (existing flag, line ~56).
12. `closing-stock-results.tsx` — hide group column for general.
13. `item-management-controls.tsx:147` and `expiry-filters-header.tsx:115` — hide "Medicine Group: A-Z" sort option for general (same as stock mode does).
14. Group subtitles hidden for general: `purchases-table.tsx`, `stock-warnings-table.tsx`, `bulk-shelf-update-preview.tsx`.
15. Sales: `sale-item-row.tsx:62` + `searchable-item-select.tsx:195` — drop group from option labels; `sales-directory-search.tsx:107-116` — hide the **Alternatives** button (pharmacy-exclusive, keyed on medicineGroup).
16. Exports: `items-export-utils.ts` (PDF/XLSX) and `expiry-export-utils.ts` (PDF/XLSX) — skip the "Group (Generic)" column for general; expiry PDF title "Medicine Expiry Report" → "Expiry Report" for general.

## Phase 4 — Copy neutralization (general only; pharmacy copy unchanged)
17. New `src/lib/store-copy.ts` — DRY helpers: `fallbackStoreName(authUser)` replacing all 14 `companyName || 'Pharmacy'` sites across export/memo/statement PDF utils, plus item-noun helpers ("Medicine"→"Item").
18. Conditional strings (general variant in parentheses): sidebar + page title "Medicines / Stocks" → ("Items / Stocks") in `sidebar-navigation.ts:27` + `(main)/layout.tsx:17`; "Medicine Expiry Alert/Warning" → ("Expiry Alert/Warning") in `item-management.tsx`, `dashboard/page.tsx`, `expiry-alerts.tsx`; bulk-shelf-update copy; `sale-items-table.tsx:98` "Medicine / Item" → ("Item"); search placeholders in `item-management-controls.tsx:55`, `purchase-search-input.tsx:30`, `sales-directory-search.tsx:34`; `sale-guards.ts:17`; `company-base-fields.tsx` "Pharmacy Name" → ("Business Name"); `security-deposit-form-fields.tsx:128`; `customer-transactions-table.tsx:30`; `mode-selection-cards.tsx` descriptions.
19. **Unchanged by design:** login subtitle and root metadata title (business type is unknown pre-sign-in — selection happens after), "Pharmora" branding, supplier-as-company purchase convention, form-factor search ranking.

## Phase 5 — Admin management (decided: admin-only changes)
20. `src/lib/db/user-settings.ts` — `adminSetUserStoreType` mirroring `adminSetUserAppMode` (incl. `invalidateCollectionCache`); live propagation to the user via existing `onSnapshot`.
21. `admin-users-table.tsx` + `src/app/admin/page.tsx` — "Pharmacy" column header → "Store"; new Business Type select (Pharmacy/General) wired to the new function.

## Phase 6 — Verification
22. `npm run build` (typecheck) + full test suite (`src/lib/__tests__/`) — logic untouched, must stay green.
23. Manual matrix: (a) existing pharmacy user — UI byte-identical; (b) new pharmacy user — current experience + type step; (c) new general user — no group UI/Alternatives, neutral copy, single starter category; (d) general × stock-mode interplay.

## Safety summary
Additive Firestore field with runtime default → no migration, no extra reads, no perf change; pharmacy code path untouched; hidden-not-removed per your established preference; admin-only mutability.

New files: 3 (`business-type-cards.tsx`, `use-store-type.ts`, `store-copy.ts`). ~30 files touched, mostly one-line conditionals.