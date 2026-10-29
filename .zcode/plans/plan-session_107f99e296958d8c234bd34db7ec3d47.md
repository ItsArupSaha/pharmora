# Due + Split Payments on the Sell Page, with Shop-Name Customer Identity

## Key findings from research
- The Cash-only restriction was pure UI: the Bank/Due radio buttons were deleted from `sale-payment-toggle.tsx` (commit 6899c26). The **entire backend already supports Due and Split**: `addSale`/`updateSale`/`deleteSale` compute dues, update `customer.dueBalance`, write Pending Receivable transactions with profit deferral; `/dues` page + Collect dialog settle them FIFO; memos and the details dialog show live "Remaining Due"; server guard `validateAmountPaid` exists; `buildReceivable` is unit-tested for Split.
- Real gaps: (1) sale form zod schema lacks `'Split'` + `amountPaid`; (2) no radio buttons; (3) Split sales never capture the owing customer (would land on Walk-in); (4) Customer model has no shop-name concept and duplicate checks only cover phone on manual add — nothing on update.

## Part A — Due & Split on the sale form

1. **`src/components/sales/schema.ts`** — `paymentMethod: z.enum(['Cash', 'Bank', 'Due', 'Split'])` (Bank stays in the enum for legacy data; no Bank radio). Add `amountPaid: z.coerce.number().optional()` with refinement: for Split, amountPaid > 0 and not above the watched payable total (server re-validates via `validateAmountPaid`). Rename due-customer fields to shop identity: `dueShopName` (required for Due/Split), `dueCustomerPhone` (6–15 digits, required), `dueContactName` (optional).
2. **`src/components/sales/sale-payment-toggle.tsx`** — re-add the `Due` radio and add a `Split` radio next to Cash (Bank stays hidden per your standing decision).
3. **New `src/components/sales/split-payment-fields.tsx`** — "Amount Paid Now (Cash)" input + live red "Due Amount: ৳…" preview (total − paid), mirroring the purchase summary's Due row pattern.
4. **`src/components/sales/due-customer-fields.tsx` rework** — fields become Shop Name (required) / Phone (required) / Contact Person (optional). Suggestions search by shop name (existing fuzzy matcher) and phone digits; chips show `shop · phone · due ৳X`; picking one autofills all three fields.
5. **`record-sale-form.tsx`** — show `DueCustomerFields` for `Due` **and** `Split`; show `SplitPaymentFields` when Split. Submit: Due sends `dueCustomer {name: shopName, phone, contactName}`; Split sends the same plus `amountPaid` and `splitPaymentMethod: 'Cash'` (hardcoded — no picker).
6. **`src/lib/db/sales-actions.ts` (addSale)** — extend the due-customer resolution block from `=== 'Due'` to `Due || Split`; reorder matching to shop-name-first (normalized exact name match reuses the customer regardless of phone — this *is* the "one shop can't be created twice" rule at sale time), then phone-tail match, then create (writes `contactName` when provided). Everything downstream (receivable, balance, profit deferral) already handles Split.
7. **Edit sale dialog** — drop the double-mounted `SalePaymentSection` (Cash/Bank + dead Split block); use the same Cash/Due/Split toggle + Split fields + the existing customer `Select` for due attribution. Load `Split` sales as Split again (keep legacy `Paid by Credit` → `Due` coercion). `updateSale` already fully reconciles balances/receivables on edit.
8. **Delete dead code**: `src/components/sales/sale-summary-section.tsx` (imported nowhere) and `sale-payment-section.tsx` once the edit dialog stops using it.
9. **No changes** to: sales history table (compact, per your preference — live status stays in the details dialog), memos (already render Remaining Due for Due/Split; I'll add the optional contact-person line under the shop name in the BILL TO block), settlement flow, exports.

## Part B — Shop-name identity & uniqueness (all customer surfaces)

10. **`src/lib/types.ts`** — `Customer` gains `contactName?: string`. The existing `name` field *becomes* the shop/business name (displays keep using `name`, so no churn across the 8 display surfaces; legacy customers are unaffected).
11. **New shared normalizer** in `src/lib/search-utils.ts` (or a small `customer-name` util): `normalizeCustomerKey` = trim → lowercase → collapse spaces — extracted from the local `nameKey` in `sales-actions.ts` so all three creation paths share one rule.
12. **`src/lib/db/customers.ts`** — `addCustomer`: check duplicate `name` by normalized key (in-memory over the customer list, same pattern as today's phone check) → throw "A shop with this name already exists"; `updateCustomer`: same check excluding the edited doc (closes a real gap — updates currently have zero duplicate checks). Bonus: this also prevents manually creating a second "Walk-in Customer".
13. **Add/edit customer dialog** (`add-customer-dialog.tsx` + `customers/schema.ts`) — relabel "Full Name" → "Shop / Customer Name", add optional "Contact Person"; same uniqueness error toast as today's duplicate phone.
14. **Display**: customers table shows contact person as small text under the shop name; dues page and customer info card add the contact as a secondary line when present; memo/statement PDFs add the contact line under the shop name in the customer block.

## Verification
15. Unit tests: `normalizeCustomerKey` dedup logic and the sale-schema Split refinements (positive amount, Due/Split shop+phone required). Existing 109 tests must stay green — no logic changes to tested calculation paths.
16. `npm run build` (typecheck) + full `npm test`.
17. Manual matrix: Cash sale (unchanged byte-for-byte flow); Due sale with existing shop (balance increments, no duplicate customer); Due with new shop (created once, second sale reuses); Split (partial cash now, remainder on dues, memo shows Remaining Due); edit a Split sale; collect due from /dues page; add/edit customer with duplicate shop name (blocked).

## Safety notes
- No DB write-path logic changes beyond extending the customer-resolution condition and `contactName` passthrough — the money math is already production-tested.
- Cash sales follow the exact same code path as today.
- New files: 2 (`split-payment-fields.tsx`, plus tests). Modified: ~12. Deleted: 2 dead components.