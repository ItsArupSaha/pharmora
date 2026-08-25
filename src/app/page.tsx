
'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { isAdminEmail } from '@/lib/admin-config';
import { getLandingPath } from '@/lib/features';

export default function Home() {
    const router = useRouter();
    const { user, authUser, loading } = useAuth();

    React.useEffect(() => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
        } else if (isAdminEmail(user.email)) {
          router.replace('/admin');
        } else {
          router.replace(getLandingPath(authUser?.appMode));
        }
      }
    }, [router, user, authUser, loading]);

    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
}
