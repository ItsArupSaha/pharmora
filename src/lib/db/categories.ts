import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';

import { db } from '../firebase';
import type { Category } from '../types';
import { cachedCollection } from './collection-cache';
import { invalidateAppData, readCatalogVersion } from './data-version';

// --- Categories Actions ---
// Cached behind the catalog version so every page mount shares one fetch.
export async function getCategories(userId: string): Promise<Category[]> {
  if (!db || !userId) return [];
  const version = await readCatalogVersion(userId);
  return cachedCollection('categories', userId, async () => {
    const categoriesCollection = collection(db!, 'users', userId, 'categories');
    const snapshot = await getDocs(query(categoriesCollection, orderBy('name')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        createdAt: data.createdAt?.toDate?.() || new Date()
      } as Category;
    });
  }, { version });
}

export async function addCategory(userId: string, data: Omit<Category, 'id' | 'createdAt'>) {
  if (!db || !userId) return;
  const categoriesCollection = collection(db, 'users', userId, 'categories');
  const newDocRef = await addDoc(categoriesCollection, {
    ...data,
    createdAt: new Date()
  });
  await invalidateAppData(userId, { scope: 'catalog' });
  return { id: newDocRef.id, ...data, createdAt: new Date() };
}

export async function updateCategory(userId: string, id: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>) {
  if (!db || !userId) return;
  const categoryRef = doc(db, 'users', userId, 'categories', id);
  await updateDoc(categoryRef, data);
  await invalidateAppData(userId, { scope: 'catalog' });
}

export async function deleteCategory(userId: string, id: string) {
  if (!db || !userId) return;
  const categoryRef = doc(db, 'users', userId, 'categories', id);
  await deleteDoc(categoryRef);
  await invalidateAppData(userId, { scope: 'catalog' });
}

// Initialize default pharmacy categories for new users
export async function initializeDefaultCategories(userId: string) {
  if (!db || !userId) return;

  const categoriesCollection = collection(db, 'users', userId, 'categories');
  const snapshot = await getDocs(categoriesCollection);

  // Only add default categories if none exist
  if (snapshot.empty) {
    await addDoc(categoriesCollection, {
      name: 'Medicines',
      description: 'Prescription and OTC drugs',
      createdAt: new Date()
    });
    await addDoc(categoriesCollection, {
      name: 'Surgicals',
      description: 'Surgical tools and instruments',
      createdAt: new Date()
    });
    await addDoc(categoriesCollection, {
      name: 'General Products',
      description: 'Toiletries, baby care, etc.',
      createdAt: new Date()
    });
  }
}
