'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModeSelectionCards } from '@/components/mode/mode-selection-cards';
import { useAuth } from '@/hooks/use-auth';
import { useSetAppMode } from '@/hooks/use-set-app-mode';

export default function ModeSelectionPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { selectMode, isPending } = useSetAppMode((mode) => {
    void mode;
    router.replace('/onboarding');
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="font-headline text-2xl font-semibold">Choose How You Will Use Pharmora</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a mode to continue setup. You can switch modes anytime — your data stays the same.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <ModeSelectionCards isPending={isPending} onSelect={(mode) => void selectMode(mode)} />
      </div>
    </div>
  );
}
