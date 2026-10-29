
import { addDoc, collection, doc, getDoc, getDocs, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { AuthUser, InitialCapital } from '../types';
import type { OnboardingFormValues } from '@/app/onboarding/schema';
import { initializeDefaultCategories } from './categories';

// --- User Initialization on First Login ---
export async function initializeNewUser(userId: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);

  // Check if the user document already has collections initialized
  if (userDoc.exists() && userDoc.data()?.initialized) {
    return; // Already initialized
  }

  const batch = writeBatch(db);

  // Create a "Walk-in Customer"
  const customersCollection = collection(userDocRef, 'customers');
  const walkInCustomerRef = doc(customersCollection);
  batch.set(walkInCustomerRef, {
    name: 'Walk-in Customer',
    phone: 'N/A',
    address: 'N/A',
    openingBalance: 0,
    dueBalance: 0,
  });

  // Create metadata for counters
  const metadataCollection = collection(userDocRef, 'metadata');
  const countersRef = doc(metadataCollection, 'counters');
  batch.set(countersRef, { lastPurchaseNumber: 0, lastSaleNumber: 0, lastReturnNumber: 0, lastExpenseNumber: 0 });
  
  // Mark user as initialized (but onboarding not yet complete)
  batch.set(userDocRef, { initialized: true }, { merge: true });


  await batch.commit();
  console.log(`Initialized database for new user: ${userId}`);
}

export async function completeOnboarding(userId: string, data: OnboardingFormValues) {
  if (!db || !userId) return;

  const userDocRef = doc(db, 'users', userId);

  // 1. Update user document with company info and mark onboarding as complete
  const userData: Partial<AuthUser> = {
    storeType: data.storeType,
    companyName: data.companyName,
    subtitle: data.subtitle,
    address: data.address,
    phone: data.phone,
    bkashNumber: data.bkashNumber,
    bankInfo: data.bankInfo,
    onboardingComplete: true,
  };

  await updateDoc(userDocRef, userData);

  // Seed starter categories matching the chosen business type
  await initializeDefaultCategories(userId, data.storeType);

  // 2. Record initial capital into a dedicated 'capital' collection
  const capitalCollection = collection(userDocRef, 'capital');
  const now = new Date();

  if (data.initialCash > 0) {
    await addDoc(capitalCollection, {
      source: 'Initial Capital',
      amount: data.initialCash,
      date: Timestamp.fromDate(now),
      paymentMethod: 'Cash',
      notes: 'Initial cash balance upon store setup.',
    });
  }

  if (data.initialBank > 0) {
    await addDoc(capitalCollection, {
      source: 'Initial Capital',
      amount: data.initialBank,
      date: Timestamp.fromDate(now),
      paymentMethod: 'Bank',
      notes: 'Initial bank balance upon store setup.',
    });
  }
  
  // Revalidate paths to ensure data is fresh across the app
}


export async function updateCompanyDetails(userId: string, data: Partial<AuthUser>) {
    if (!db || !userId) return;
    const userDocRef = doc(db, 'users', userId);

    const updateData: Partial<AuthUser> = {};
    if (data.companyName) updateData.companyName = data.companyName;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.address) updateData.address = data.address;
    if (data.phone) updateData.phone = data.phone;
    if (data.bkashNumber !== undefined) updateData.bkashNumber = data.bkashNumber;
    if (data.bankInfo !== undefined) updateData.bankInfo = data.bankInfo;

    await updateDoc(userDocRef, updateData);
}

// --- Database Summary ---

// Get the summed initial capital
export async function getInitialCapital(userId: string): Promise<InitialCapital> {
    if (!db || !userId) return { cash: 0, bank: 0 };
    const capitalCollection = collection(db, 'users', userId, 'capital');
    const snapshot = await getDocs(capitalCollection);
    
    let cash = 0;
    let bank = 0;
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.paymentMethod === 'Cash') {
            cash += data.amount;
        } else if (data.paymentMethod === 'Bank') {
            bank += data.amount;
        }
    });

    return { cash, bank };
}

// Adjust capital by adding a new transaction
export async function adjustInitialCapital(userId: string, adjustments: { cash: number, bank: number }) {
    if (!db || !userId) return;
    const capitalCollection = collection(db, 'users', userId, 'capital');
    const now = new Date();

    if (adjustments.cash !== 0) {
        await addDoc(capitalCollection, {
            source: 'Capital Adjustment',
            amount: adjustments.cash,
            date: Timestamp.fromDate(now),
            paymentMethod: 'Cash',
            notes: `Manual adjustment of cash capital.`,
        });
    }
    
    if (adjustments.bank !== 0) {
        await addDoc(capitalCollection, {
            source: 'Capital Adjustment',
            amount: adjustments.bank,
            date: Timestamp.fromDate(now),
            paymentMethod: 'Bank',
            notes: `Manual adjustment of bank capital.`,
        });
    }

    if (adjustments.cash !== 0 || adjustments.bank !== 0) {
    }
}
