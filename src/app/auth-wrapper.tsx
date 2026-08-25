
'use client';

import { useAuth } from '@/hooks/use-auth';
import { getLandingPath } from '@/lib/features';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Loader2 } from 'lucide-react';

const AUTH_PAGES = ['/login', '/onboarding', '/mode-selection'];

export function AppWithAuthProvider({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (loading) return;

    const isAuthPage = AUTH_PAGES.some((page) => pathname === page);

    if (!authUser) {
      // If not logged in and not on login page, redirect to login
      if (pathname !== '/login') {
        router.replace('/login');
      }
    } else {
      // If logged in...
      if (!authUser.onboardingComplete) {
        // ...mode comes first, then onboarding
        if (!authUser.appModeChosen) {
          if (pathname !== '/mode-selection') {
            router.replace('/mode-selection');
          }
        } else if (pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
      } else {
        // ...and onboarding is complete, but they are on an auth page, redirect to landing
        if (isAuthPage) {
          router.replace(getLandingPath(authUser.appMode));
        }
      }
    }
  }, [authUser, loading, router, pathname]);

  const onPreOnboardingPage = pathname === '/mode-selection' || pathname === '/onboarding';
  const showLoader =
    loading ||
    (!authUser && pathname !== '/login') ||
    (authUser && !authUser.onboardingComplete && !onPreOnboardingPage);

  if (showLoader) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
