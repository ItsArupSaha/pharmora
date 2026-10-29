
'use client';

import { initializeNewUser } from '@/lib/db/database';
import { auth, db } from '@/lib/firebase';
import { isAdminEmail } from '@/lib/admin-config';
import type { AuthUser } from '@/lib/types';
import {
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import * as React from 'react';

interface AuthContextType {
  user: User | null;
  authUser: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

// Applies safe defaults so consumers never deal with undefined mode/status,
// including accounts created before these fields existed.
function normalizeAuthUser(data: Partial<AuthUser>): AuthUser {
  return {
    ...data,
    appMode: data.appMode ?? 'normal',
    accountStatus: data.accountStatus ?? 'active',
    storeType: data.storeType ?? 'pharmacy',
  } as AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!auth || !db) {
      console.warn('Firebase not configured. Auth functionality will be disabled.');
      setLoading(false);
      return;
    }

    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      unsubscribeUserDoc?.();
      unsubscribeUserDoc = null;

      if (!currentUser || !db) {
        setUser(null);
        setAuthUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // New user, create their document and initialize their data.
        // The admin account (from .env) skips onboarding entirely.
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          createdAt: serverTimestamp(),
          onboardingComplete: isAdminEmail(currentUser.email),
        });
        await initializeNewUser(currentUser.uid);
      }

      // Live subscription keeps mode and account status fresh, so an admin
      // suspend or mode change is reflected without a re-login.
      unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setAuthUser(normalizeAuthUser(docSnap.data()));
        }
      });

      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeUserDoc?.();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Firebase not configured');
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error during sign-in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) {
      throw new Error('Firebase not configured');
    }
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error during sign-out:', error);
    }
  };

  const value = { user, authUser, loading, signInWithGoogle, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
