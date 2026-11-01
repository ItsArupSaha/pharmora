import { collection, doc, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';
import { getCustomers } from './customers';
import { normalizeCustomerKey } from '../search-utils';
import type { Customer } from '../types';

export interface DueCustomerInput {
  name: string;
  phone: string;
  contactName?: string;
}

export type DueCustomerMode = 'reuse' | 'create';

export type DueCustomerResolution =
  | { ok: true; customerId: string; mode: DueCustomerMode }
  | { ok: false; error: string };

export function phoneDigits(phone: string | undefined): string {
  return (phone || '').replace(/\D/g, '');
}

/** Due and split sales identify the shop by name + phone before anything else. */
export function validateDueCustomerInput(input: DueCustomerInput | undefined): string | null {
  const name = (input?.name || '').trim();
  const digits = phoneDigits(input?.phone);
  if (!name || digits.length < 6 || digits.length > 15) {
    return 'Due and split sales need a shop name and a valid phone number.';
  }
  return null;
}

/**
 * Resolves the shop a due/split sale belongs to. The shop name is the
 * identity: an exact (case/spacing-insensitive) name match reuses the shop no
 * matter what, so one shop can never be created twice; a phone-digit match
 * (with country-prefix tolerance) is the fallback. Only a genuinely new shop
 * resolves as 'create'. Shared by addSale and updateSale so both flows agree
 * on when a customer record is reused vs created.
 */
export async function resolveDueCustomer(
  userId: string,
  input: DueCustomerInput
): Promise<DueCustomerResolution> {
  const inputError = validateDueCustomerInput(input);
  if (inputError) return { ok: false, error: inputError };

  const name = input.name.trim();
  const digits = phoneDigits(input.phone);
  const existing = await getCustomers(userId); // cached, version-guarded

  const byShopName = existing.find(
    (c) => normalizeCustomerKey(c.name) === normalizeCustomerKey(name) && normalizeCustomerKey(c.name) !== 'walk-in customer'
  );
  const phoneTail = digits.slice(-10);
  const byPhone = byShopName ||
    existing.find((c) => {
      const d = phoneDigits(c.phone);
      if (d === digits) return true;
      // Tolerate country-prefix differences (8801… vs 01…) on 6+ digit numbers.
      return d.length >= 6 && digits.length >= 6 &&
        (d.endsWith(phoneTail) || digits.endsWith(d.slice(-10)));
    });

  if (byPhone) {
    return { ok: true, customerId: byPhone.id, mode: 'reuse' };
  }
  // Fresh id for a genuinely new shop; the caller creates the customer
  // document with it inside its own transaction.
  const customersCollection = collection(db!, 'users', userId, 'customers');
  return { ok: true, customerId: doc(customersCollection).id, mode: 'create' };
}

/**
 * In-transaction half of the resolution: creates the new shop document, or
 * fills in contact details on a reused shop only where the record is missing
 * them — never overwriting what is already stored.
 */
export function applyDueCustomerInTx(
  transaction: Transaction,
  customerRef: Parameters<Transaction['set']>[0],
  existingData: Partial<Customer> | null,
  input: DueCustomerInput,
  mode: DueCustomerMode
): void {
  if (mode === 'create') {
    transaction.set(customerRef, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: 'N/A',
      openingBalance: 0,
      dueBalance: 0,
      ...(input.contactName ? { contactName: input.contactName } : {}),
    });
    return;
  }

  const patch: { phone?: string; contactName?: string } = {};
  const existingPhone = phoneDigits(existingData?.phone);
  if (!existingPhone && input.phone) {
    patch.phone = input.phone.trim();
  }
  if (!existingData?.contactName && input.contactName) {
    patch.contactName = input.contactName;
  }
  if (Object.keys(patch).length > 0) {
    transaction.update(customerRef, patch);
  }
}
