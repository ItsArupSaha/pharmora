
'use client';

import { MonthlySummaryChart } from '@/components/dashboard-charts';
import { EditCompanyDetailsDialog } from '@/components/edit-company-details-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useAuth } from '@/hooks/use-auth';
import { getDashboardStats } from '@/lib/db/dashboard';
import { countExpiringItems } from '@/lib/db/item-alerts';
import { ArrowRightLeft, DollarSign, Settings, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export default function DashboardPage() {
  const { user, authUser } = useAuth();
  const { canWrite } = useAccountAccess();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [alertCount, setAlertCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      const offset = new Date().getTimezoneOffset();
      getDashboardStats(user.uid, offset).then(data => {
        setStats(data);
        setIsLoading(false);
      });
      // Fetch expiring medicines count
      countExpiringItems(user.uid, 30).then(count => {
        setAlertCount(count);
      }).catch(err => console.error("Failed to fetch alert count for dashboard:", err));
    }
  }, [user]);

  if (isLoading || !stats || !authUser) {
    return (
        <div className="flex flex-col gap-6 animate-in fade-in-50">
        <h1 className="font-headline text-3xl font-semibold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-4 w-2/3" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-7 w-1/3 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                </Card>
            ))}
        </div>
        <div>
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-1/4" /></CardTitle>
                    <CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <Skeleton className="h-[350px] w-full" />
                </CardContent>
            </Card>
        </div>
    </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-headline text-3xl font-semibold">Dashboard</h1>
        <EditCompanyDetailsDialog user={authUser}>
          <Button variant="outline" className="w-full sm:w-auto" disabled={!canWrite}>
            <Settings className="mr-2 h-4 w-4" />
            Edit Store Details
          </Button>
        </EditCompanyDetailsDialog>
      </div>

      {alertCount > 0 && (() => {
        const alertTitle = 'Medicine Expiry Warning';
        const alertText = `There are ${alertCount} medicine(s) expired or expiring within 30 days. Please check and return or replace them.`;
        return (
          <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 rounded-lg flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 dark:text-amber-400">{alertTitle}</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">{alertText}</p>
              <Link 
                href="/expiry-alerts" 
                className="inline-block mt-1 text-sm text-amber-800 dark:text-amber-400 font-semibold underline hover:text-amber-900"
              >
                Go to Expiry Alerts page
              </Link>
            </div>
          </div>
        );
      })()}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales this Month</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.monthlySalesValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.monthlySalesCount} transactions recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit this Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ৳{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              After ৳{stats.monthlyExpenses.toLocaleString()} in expenses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receivables</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{stats.receivablesAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.pendingReceivablesCount} customer(s) with due balance</p>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <MonthlySummaryChart
            income={stats.monthlySalesValue}
            expenses={stats.monthlyExpenses}
            profit={stats.netProfit}
          />
      </div>
    </div>
  );
}
