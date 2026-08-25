'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModeSelectionCards } from '@/components/mode/mode-selection-cards';
import { useAuth } from '@/hooks/use-auth';
import { useSetAppMode } from '@/hooks/use-set-app-mode';
import { getLandingPath } from '@/lib/features';

export function ModeSwitcher() {
  const { authUser } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const { selectMode, isPending } = useSetAppMode((mode) => {
    setIsOpen(false);
    router.replace(getLandingPath(mode));
  });

  const currentMode = authUser?.appMode;
  const label = currentMode === 'stock' ? 'Stock Mode' : 'Normal Mode';

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => setIsOpen(true)}
        title="Switch app mode"
      >
        <ArrowLeftRight className="mr-2 h-4 w-4" />
        Mode: {label}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline">Switch App Mode</DialogTitle>
            <DialogDescription>
              Your data stays the same in both modes. Your last choice is remembered.
            </DialogDescription>
          </DialogHeader>
          <ModeSelectionCards
            currentMode={currentMode}
            isPending={isPending}
            onSelect={(mode) => void selectMode(mode)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
