
'use client';

import { useAuth } from '@/hooks/use-auth';
import { isAdminEmail } from '@/lib/admin-config';
import { getLandingPath } from '@/lib/features';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Loader2 } from 'lucide-react';

const AUTH_PAGES = ['/login', '/onboarding'];

export function AppWithAuthProvider({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // The app admin (configured via .env) never goes through onboarding; their
  // home is the admin panel.
  const isAdmin = isAdminEmail(authUser?.email);
  const isOnboarded = isAdmin || Boolean(authUser?.onboardingComplete);

  React.useEffect(() => {
    if (loading) return;

    const isAuthPage = AUTH_PAGES.some((page) => pathname === page);

    if (!authUser) {
      // If not logged in and not on login page, redirect to login
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } else if (isAdmin) {
      if (isAuthPage) {
        router.replace('/admin');
      }
    } else if (!authUser.onboardingComplete) {
      if (pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
    } else if (isAuthPage) {
      // Onboarding complete but sitting on an auth page — go to the mode landing
      router.replace(getLandingPath(authUser.appMode));
    }
  }, [authUser, isAdmin, loading, router, pathname]);

  const showLoader =
    loading ||
    (!authUser && pathname !== '/login') ||
    (authUser && !isOnboarded && pathname !== '/onboarding');

  if (showLoader) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
