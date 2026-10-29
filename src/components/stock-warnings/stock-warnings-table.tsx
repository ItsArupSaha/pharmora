'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Package, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useStoreType } from '@/hooks/use-store-type';
import type { Item } from '@/lib/types';

interface StockWarningsTableProps {
  isLoading: boolean;
  filteredItems: Item[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  stockThreshold: number;
  setStockThreshold: (t: number) => void;
  companies: string[];
  selectedCompany: string;
  setSelectedCompany: (c: string) => void;
}

export function StockWarningsTable({
  isLoading,
  filteredItems,
  searchQuery,
  setSearchQuery,
  stockThreshold,
  setStockThreshold,
  companies,
  selectedCompany,
  setSelectedCompany,
}: StockWarningsTableProps) {
  const router = useRouter();
  const { isPharmacy } = useStoreType();

  return (
    <Card className="max-w-5xl mx-auto border border-muted/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline text-2xl">
              Stock Warnings
            </CardTitle>
            <CardDescription>
              List of items requiring attention (Out of stock or less than {stockThreshold} {stockThreshold === 1 ? 'unit' : 'units'}).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Threshold Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Threshold:</span>
              <Select
                value={stockThreshold.toString()}
                onValueChange={(val) => setStockThreshold(parseInt(val, 10))}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="1" className="text-xs">
                    Below 1 unit
                  </SelectItem>
                  <SelectItem value="2" className="text-xs">
                    Below 2 units
                  </SelectItem>
                  <SelectItem value="3" className="text-xs">
                    Below 3 units
                  </SelectItem>
                  <SelectItem value="4" className="text-xs">
                    Below 4 units
                  </SelectItem>
                  <SelectItem value="5" className="text-xs">
                    Below 5 units
                  </SelectItem>
                  <SelectItem value="10" className="text-xs">
                    Below 10 units
                  </SelectItem>
                  <SelectItem value="20" className="text-xs">
                    Below 20 units
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Company Filter Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Company:</span>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all" className="text-xs">
                    All Companies
                  </SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company} className="text-xs">
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-8 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading stock warnings...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center border-2 border-dashed rounded-lg">
            <Package className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="font-semibold text-foreground">No warnings found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedCompany !== 'all'
                  ? 'Try clearing your filters or search query.'
                  : 'Everything looks well stocked!'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Stock Level</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isOutOfStock = item.stock === 0;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div>
                          <span className="block text-sm text-foreground">{item.title}</span>
                          {(isPharmacy ? item.medicineGroup || item.company : item.company) && (
                            <span className="block text-[11px] text-muted-foreground">
                              {item.company}{' '}
                              {isPharmacy && item.medicineGroup ? `- ${item.medicineGroup}` : ''}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.location || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'font-semibold text-xs',
                              isOutOfStock
                                ? 'bg-red-100 text-red-800 hover:bg-red-100'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                            )}
                          >
                            {isOutOfStock ? 'Out of Stock' : `Low Stock: ${item.stock}`}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/purchases')}
                            className="h-8 border-muted text-xs flex items-center gap-1 text-primary hover:text-primary"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Restock
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
