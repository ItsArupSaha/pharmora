import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AccountStatus, AppMode, AuthUser } from '../types';
import { isAdminEmail } from '../admin-config';
import { cachedCollection, invalidateCollectionCache } from './collection-cache';

export type AdminUserRecord = AuthUser & { uid: string };

export async function setAppMode(userId: string, appMode: AppMode): Promise<void> {
  if (!db || !userId) return;
  await updateDoc(doc(db, 'users', userId), { appMode });
}

function assertAdmin(): string {
  const email = auth?.currentUser?.email;
  if (!isAdminEmail(email)) {
    throw new Error('Only the app admin can perform this action.');
  }
  return auth!.currentUser!.uid;
}

// The users collection is tiny (one doc per client account) and only the
// admin ever lists it, but it goes through the same read cache as everything
// else so repeated refreshes don't re-read the same documents. The admin's
// own account is not a client and is excluded from the listing.
async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  if (!db) return [];
  const adminUid = assertAdmin();
  return cachedCollection('admin-users', adminUid, async () => {
    const snapshot = await getDocs(collection(db!, 'users'));
    return snapshot.docs
      .map((doc) => ({
        ...(doc.data() as Omit<AuthUser, 'uid'>),
        uid: doc.id,
      }))
      .filter((record) => !isAdminEmail(record.email));
  });
}

export async function adminListUsers(): Promise<AdminUserRecord[]> {
  return fetchAdminUsers();
}

async function adminUpdateUser(
  targetUserId: string,
  update: Record<string, unknown>
): Promise<void> {
  if (!db) return;
  const adminUid = assertAdmin();
  await updateDoc(doc(db, 'users', targetUserId), update);
  invalidateCollectionCache('admin-users', adminUid);
}

export async function adminSetUserAppMode(
  targetUserId: string,
  appMode: AppMode
): Promise<void> {
  await adminUpdateUser(targetUserId, { appMode });
}

export async function adminSetAccountStatus(
  targetUserId: string,
  accountStatus: AccountStatus
): Promise<void> {
  await adminUpdateUser(targetUserId, { accountStatus });
}
