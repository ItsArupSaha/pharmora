'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { isAdminEmail } from '@/lib/admin-config';

export function AdminPanelLink() {
  const { user } = useAuth();
  if (!isAdminEmail(user?.email)) return null;

  return (
    <Button variant="secondary" size="sm" className="w-full justify-start" asChild>
      <Link href="/admin">
        <ShieldCheck className="mr-2 h-4 w-4" />
        Admin Panel
      </Link>
    </Button>
  );
}
