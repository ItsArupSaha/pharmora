
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { APP_NAME } from '@/lib/app-info';
import { getLandingPath } from '@/lib/features';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width="24px"
        height="24px"
        {...props}
      >
        <path
          fill="#FFC107"
          d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
        />
        <path
          fill="#FF3D00"
          d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
        />
        <path
          fill="#1976D2"
          d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.978,36.213,44,30.608,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        />
      </svg>
    );
  }

export default function LoginPage() {
  const router = useRouter();
  const { authUser, signInWithGoogle, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!loading && authUser) {
      if (!authUser.onboardingComplete) {
        router.replace(authUser.appModeChosen ? '/onboarding' : '/mode-selection');
      } else {
        router.replace(getLandingPath(authUser.appMode));
      }
    }
  }, [authUser, loading, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      // The effect above will handle the redirect
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: 'Could not sign in with Google. Please try again.',
      });
      setIsSigningIn(false);
    }
  };

  if (loading || authUser) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center mb-8">
                <Image src="/logo.png" alt="Pharmora" width={96} height={64} priority className="h-16 w-auto mb-4" />
                <h1 className="font-headline text-3xl font-semibold text-primary">{APP_NAME}</h1>
                <p className="text-muted-foreground mt-2">Sign in to your pharmacy</p>
            </div>
            <Button 
                onClick={handleSignIn} 
                disabled={isSigningIn}
                className="w-full h-12 text-base"
            >
                {isSigningIn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <GoogleIcon className="mr-3" />
                )}
                Sign in with Google
            </Button>
        </div>
    </div>
  );
}
