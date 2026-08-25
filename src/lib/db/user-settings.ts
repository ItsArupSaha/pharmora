import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AccountStatus, AppMode, AuthUser } from '../types';
import { isAdminEmail } from '../admin-config';

export type AdminUserRecord = AuthUser & { uid: string };

export async function setAppMode(userId: string, appMode: AppMode): Promise<void> {
  if (!db || !userId) return;
  await updateDoc(doc(db, 'users', userId), { appMode, appModeChosen: true });
}

function assertAdmin(): void {
  const email = auth?.currentUser?.email;
  if (!isAdminEmail(email)) {
    throw new Error('Only the app admin can perform this action.');
  }
}

export async function adminListUsers(): Promise<AdminUserRecord[]> {
  if (!db) return [];
  assertAdmin();
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<AuthUser, 'uid'>),
    uid: doc.id,
  }));
}

export async function adminSetUserAppMode(
  targetUserId: string,
  appMode: AppMode
): Promise<void> {
  if (!db) return;
  assertAdmin();
  await updateDoc(doc(db, 'users', targetUserId), { appMode });
}

export async function adminSetAccountStatus(
  targetUserId: string,
  accountStatus: AccountStatus
): Promise<void> {
  if (!db) return;
  assertAdmin();
  await updateDoc(doc(db, 'users', targetUserId), { accountStatus });
}
