'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { useOnboarding } from '@/hooks/use-onboarding';
import { BusinessTypeCards } from '@/components/onboarding/business-type-cards';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import type { StoreType } from '@/lib/types';

export default function OnboardingPage() {
  const { authLoading, isSubmitting, form, handleSignOut, onSubmit } = useOnboarding();
  const [step, setStep] = React.useState<1 | 2>(1);
  // Kept outside the form so no business type is pre-selected — the choice
  // must be conscious before Continue unlocks.
  const [selectedType, setSelectedType] = React.useState<StoreType | undefined>(undefined);

  const handleTypeSelect = (storeType: StoreType) => {
    setSelectedType(storeType);
    form.setValue('storeType', storeType, { shouldValidate: true });
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="font-headline text-2xl">Welcome! Set Up Your Store</CardTitle>
              <CardDescription>
                {step === 1
                  ? 'First, tell us what kind of business you run.'
                  : 'Please provide some basic information about your business to get started.'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-6">
              <BusinessTypeCards value={selectedType} onSelect={handleTypeSelect} />
              <div className="flex justify-end">
                <Button
                  disabled={!selectedType}
                  onClick={() => setStep(2)}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <OnboardingForm
                form={form}
                isSubmitting={isSubmitting}
                onSubmit={onSubmit}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
