'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { completeOnboarding } from '@/lib/actions';
import { getLandingPath } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { onboardingSchema, type OnboardingFormValues } from '@/app/onboarding/schema';

export function useOnboarding() {
  const { user, authUser, loading: authLoading, signOut } = useAuth();
  const mode = authUser?.appMode;
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      companyName: '',
      subtitle: '',
      address: '',
      phone: '',
      bkashNumber: '',
      bankInfo: '',
      initialCash: 0,
      initialBank: 0,
    },
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to complete onboarding.',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, data);
      toast({
        title: 'Setup Complete!',
        description: 'Your shop inventory is now ready to use.',
      });
      // Force a reload to ensure the auth state is updated with onboarding status
      window.location.href = getLandingPath(mode);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not save your store details. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    user,
    authLoading,
    isSubmitting,
    form,
    handleSignOut,
    onSubmit,
  };
}
