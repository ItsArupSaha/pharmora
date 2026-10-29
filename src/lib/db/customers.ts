
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Customer, CustomerWithDue } from '../types';
import { normalizeCustomerKey } from '../search-utils';
import { docToCustomer } from './utils';
import { cachedCollection } from './collection-cache';
import { invalidateAppData, readLedgerVersion } from './data-version';

// --- Customers Actions ---
export async function getCustomers(userId: string): Promise<Customer[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection('customers', userId, async () => {
        const customersCollection = collection(db!, 'users', userId, 'customers');
        const snapshot = await getDocs(query(customersCollection, orderBy('name')));
        return snapshot.docs.map(docToCustomer);
    }, { version });
}

export async function getCustomersPaginated({ userId, pageLimit = 5, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ customers: Customer[], hasMore: boolean }> {
    if (!db || !userId) return { customers: [], hasMore: false };

    const customersCollection = collection(db, 'users', userId, 'customers');
    let q = query(
        customersCollection,
        orderBy('name'),
        limit(pageLimit)
    );

    if (lastVisibleId) {
        const lastVisibleDoc = await getDoc(doc(customersCollection, lastVisibleId));
        if (lastVisibleDoc.exists()) {
            q = query(q, startAfter(lastVisibleDoc));
        }
    }

    const snapshot = await getDocs(q);
    const customers = snapshot.docs.map(docToCustomer);

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    let hasMore = false;
    if (lastDoc) {
        const nextQuery = query(customersCollection, orderBy('name'), startAfter(lastDoc), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }

    return { customers, hasMore };
}


export async function getCustomerById(userId: string, id: string): Promise<Customer | null> {
    if (!db || !userId) return null;
    const docRef = doc(db, 'users', userId, 'customers', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docToCustomer(docSnap);
    } else {
        return null;
    }
}

export async function getCustomersWithDueBalance(userId: string): Promise<CustomerWithDue[]> {
    if (!db || !userId) return [];

    const customersCollection = collection(db, 'users', userId, 'customers');
    const q = query(customersCollection, where('dueBalance', '>', 0), orderBy('dueBalance', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({ ...docToCustomer(d), dueBalance: d.data().dueBalance } as CustomerWithDue));
}

export async function getCustomersWithNegativeBalance(userId: string): Promise<CustomerWithDue[]> {
    if (!db || !userId) return [];

    const customersCollection = collection(db, 'users', userId, 'customers');
    const q = query(customersCollection, where('dueBalance', '<', 0), orderBy('dueBalance', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({ ...docToCustomer(d), dueBalance: d.data().dueBalance } as CustomerWithDue));
}

export async function getCustomersWithDueBalancePaginated({ userId, pageLimit = 5, lastVisible }: { userId: string, pageLimit?: number, lastVisible?: { id: string, dueBalance: number } }): Promise<{ customersWithDue: CustomerWithDue[], hasMore: boolean }> {
    if (!db || !userId) return { customersWithDue: [], hasMore: false };

    const allCustomersWithDue = await getCustomersWithDueBalance(userId);

    let startIndex = 0;
    if (lastVisible) {
        startIndex = allCustomersWithDue.findIndex(c => c.id === lastVisible.id) + 1;
    }

    const paginatedCustomers = allCustomersWithDue.slice(startIndex, startIndex + pageLimit);
    const hasMore = startIndex + pageLimit < allCustomersWithDue.length;

    return { customersWithDue: paginatedCustomers, hasMore };
}


// --- Duplicate shop-name guard ---
// The shop name is the customer's identity, so the same name (compared
// case- and spacing-insensitively) can never be registered twice. The
// customer list is small and cache-backed, so this is an in-memory scan.
async function findDuplicateShopName(
    userId: string,
    name: string,
    excludeId?: string
): Promise<Customer | undefined> {
    const existing = await getCustomers(userId);
    const key = normalizeCustomerKey(name);
    return existing.find((c) => c.id !== excludeId && normalizeCustomerKey(c.name) === key);
}

export async function addCustomer(userId: string, data: Omit<Customer, 'id' | 'dueBalance'>) {
    if (!db || !userId) return;
    const customersCollection = collection(db, 'users', userId, 'customers');

    // --- Duplicate check by shop name ---
    const duplicateShop = await findDuplicateShopName(userId, data.name);
    if (duplicateShop) {
        throw new Error(`A shop named "${data.name}" already exists.`);
    }

    // --- Duplicate check by phone number ---
    const phoneQuery = query(customersCollection, where('phone', '==', data.phone));
    const phoneSnapshot = await getDocs(phoneQuery);
    if (!phoneSnapshot.empty) {
        const existing = phoneSnapshot.docs[0].data();
        throw new Error(`A customer with phone number "${data.phone}" already exists: ${existing.name}`);
    }

    // --- Duplicate check by WhatsApp number (if provided) ---
    if (data.whatsapp && data.whatsapp.trim() !== '') {
        const waQuery = query(customersCollection, where('whatsapp', '==', data.whatsapp));
        const waSnapshot = await getDocs(waQuery);
        if (!waSnapshot.empty) {
            const existing = waSnapshot.docs[0].data();
            throw new Error(`A customer with WhatsApp number "${data.whatsapp}" already exists: ${existing.name}`);
        }
    }

    const dataWithDue = { ...data, dueBalance: data.openingBalance || 0 };
    const newDocRef = await addDoc(customersCollection, dataWithDue);
    await invalidateAppData(userId, { scope: 'ledger' });
    return { id: newDocRef.id, ...dataWithDue };
}

export async function updateCustomer(userId: string, id: string, data: Omit<Customer, 'id' | 'dueBalance'>) {
    if (!db || !userId) return;
    // Renaming to a name another shop already has is blocked, same rule as add.
    const duplicateShop = await findDuplicateShopName(userId, data.name, id);
    if (duplicateShop) {
        throw new Error(`A shop named "${data.name}" already exists.`);
    }
    const customerRef = doc(db, 'users', userId, 'customers', id);
    await updateDoc(customerRef, data);
    await invalidateAppData(userId, { scope: 'ledger' });
}

export async function deleteCustomer(userId: string, id: string) {
    if (!db || !userId) return;
    const customerRef = doc(db, 'users', userId, 'customers', id);
    await deleteDoc(customerRef);
    await invalidateAppData(userId, { scope: 'ledger' });
}
