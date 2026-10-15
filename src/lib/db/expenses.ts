
import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Expense, Metadata } from '../types';
import { docToExpense } from './utils';
import { cachedCollection } from './collection-cache';
import { invalidateAppData, readLedgerVersion } from './data-version';

// --- Expenses Actions ---
export async function getExpenses(userId: string): Promise<Expense[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection('expenses-master', userId, async () => {
    const expensesCollection = collection(db!, 'users', userId, 'expenses');
    const snapshot = await getDocs(query(expensesCollection, orderBy('date', 'desc')));
    const expenses = snapshot.docs.map(docToExpense);
    
    // Filter out transfer-related expenses (they shouldn't affect profit calculation)
    return expenses.filter(expense => !expense.description.startsWith('Transfer to'));
    }, { version });
}

export async function getExpensesPaginated({ userId, pageLimit = 5, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ expenses: Expense[], hasMore: boolean }> {
  if (!db || !userId) return { expenses: [], hasMore: false };

  const expensesCollection = collection(db, 'users', userId, 'expenses');
  let q = query(
      expensesCollection,
      orderBy('date', 'desc'),
      limit(pageLimit)
  );

  if (lastVisibleId) {
      const lastVisibleDoc = await getDoc(doc(expensesCollection, lastVisibleId));
      if (lastVisibleDoc.exists()) {
          q = query(q, startAfter(lastVisibleDoc));
      }
  }

  const snapshot = await getDocs(q);
  const expenses = snapshot.docs.map(docToExpense);
  
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  let hasMore = false;
  if(lastDoc) {
    const nextQuery = query(expensesCollection, orderBy('date', 'desc'), startAfter(lastDoc), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    hasMore = !nextSnapshot.empty;
  }

  return { expenses, hasMore };
}

export async function getExpensesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Expense[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection(
        `ledger-master:report:expenses:${startDate.toISOString()}:${endDate.toISOString()}`,
        userId,
        async () => {
            const expensesCollection = collection(db!, 'users', userId, 'expenses');
            const q = query(
                expensesCollection,
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate)),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            const expenses = snapshot.docs.map(docToExpense);

            // Filter out transfer-related expenses (they shouldn't affect profit calculation)
            return expenses.filter(expense => !expense.description.startsWith('Transfer to'));
        },
        { version }
    );
}

export async function getExpensesForMonth(userId: string, year: number, month: number, offsetMinutes?: number): Promise<Expense[]> {
    if (offsetMinutes !== undefined) {
        let startMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
        let endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
        startMs += offsetMinutes * 60 * 1000;
        endMs += offsetMinutes * 60 * 1000;
        return getExpensesForDateRange(userId, new Date(startMs), new Date(endMs));
    }
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return getExpensesForDateRange(userId, startDate, endDate);
}

export async function getExpensesForDay(userId: string, dateString: string, offsetMinutes?: number): Promise<Expense[]> {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    if (offsetMinutes !== undefined) {
        let startMs = Date.UTC(year, month, day, 0, 0, 0, 0);
        let endMs = Date.UTC(year, month, day, 23, 59, 59, 999);
        startMs += offsetMinutes * 60 * 1000;
        endMs += offsetMinutes * 60 * 1000;
        return getExpensesForDateRange(userId, new Date(startMs), new Date(endMs));
    }

    const startDate = new Date(year, month, day, 0, 0, 0, 0);
    const endDate = new Date(year, month, day, 23, 59, 59, 999);
    return getExpensesForDateRange(userId, startDate, endDate);
}

export async function addExpense(userId: string, data: Omit<Expense, 'id' | 'expenseId' | 'date'> & { date: Date }): Promise<Expense> {
    if (!db || !userId) throw new Error("Database not connected");
    
    try {
        const result = await runTransaction(db, async (transaction) => {
            const userRef = doc(db!, 'users', userId);
            const metadataRef = doc(userRef, 'metadata', 'counters');
            const expensesCollection = collection(userRef, 'expenses');
            
            const metadataDoc = await transaction.get(metadataRef);
            let lastExpenseNumber = 0;
            if (metadataDoc.exists()) {
                lastExpenseNumber = (metadataDoc.data() as Metadata).lastExpenseNumber || 0;
            }
            const newExpenseNumber = lastExpenseNumber + 1;
            const expenseId = `EXP-${String(newExpenseNumber).padStart(4, '0')}`;
            
            const expenseData = {
                ...data,
                expenseId,
                date: Timestamp.fromDate(data.date),
            };
            
            const newDocRef = doc(expensesCollection);
            transaction.set(newDocRef, expenseData);
            transaction.set(metadataRef, { lastExpenseNumber: newExpenseNumber }, { merge: true });
            
            return { id: newDocRef.id, expenseId, ...data, date: data.date.toISOString() };
        });
        
        await invalidateAppData(userId, { scope: 'ledger' });
        return result;
    } catch (e) {
        console.error("Expense creation failed: ", e);
        throw e instanceof Error ? e : new Error('An unknown error occurred during expense creation.');
    }
}

export async function updateExpense(userId: string, id: string, data: Omit<Expense, 'id' | 'expenseId' | 'date'> & { date: Date }): Promise<Expense> {
    if (!db || !userId) throw new Error("Database not connected");
    const expenseRef = doc(db, 'users', userId, 'expenses', id);
    
    // Get existing expense to preserve expenseId
    const existingExpense = await getDoc(expenseRef);
    if (!existingExpense.exists()) {
        throw new Error("Expense not found");
    }
    const existingData = existingExpense.data();
    
    const expenseData = {
        ...data,
        expenseId: existingData.expenseId, // Preserve existing expenseId
        date: Timestamp.fromDate(data.date),
    };
    await updateDoc(expenseRef, expenseData);
    await invalidateAppData(userId, { scope: 'ledger' });
    return { ...data, id, expenseId: existingData.expenseId, date: data.date.toISOString() };
}

export async function deleteExpense(userId: string, id: string) {
    if (!db || !userId) return;
    const expenseRef = doc(db, 'users', userId, 'expenses', id);
    await deleteDoc(expenseRef);
    await invalidateAppData(userId, { scope: 'ledger' });
}
