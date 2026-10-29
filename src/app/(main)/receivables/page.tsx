'use client';
import ReceivablesManagement from '@/components/receivables/receivables-management';
import { useAuth } from '@/hooks/use-auth';
import { HandCoins } from 'lucide-react';

export default function ReceivablesPage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <HandCoins className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return <ReceivablesManagement userId={user.uid} />;
}
