'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { Category } from '@/lib/types';

interface ItemManagementControlsProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setVisibleCount: (n: number) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (category: string) => void;
  categories: Category[];
  companies?: string[];
  selectedCompanyFilter?: string;
  setSelectedCompanyFilter?: (company: string) => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (status: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

export function ItemManagementControls({
  searchQuery,
  setSearchQuery,
  setVisibleCount,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  categories,
  companies = [],
  selectedCompanyFilter = 'all',
  setSelectedCompanyFilter,
  selectedStatusFilter,
  setSelectedStatusFilter,
  sortBy,
  setSortBy,
}: ItemManagementControlsProps) {
  // Stock-management mode hides generic-group sorting along with its column.
  const isStockMode = useAuth().authUser?.appMode === 'stock';
  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medicines by name, group, manufacturer, category..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(10);
            }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery('');
                setVisibleCount(10);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedCategoryFilter}
            onValueChange={(val) => {
              setSelectedCategoryFilter(val);
              setVisibleCount(10);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {companies.length > 0 && setSelectedCompanyFilter && (
            <Select
              value={selectedCompanyFilter}
              onValueChange={(val) => {
                setSelectedCompanyFilter(val);
                setVisibleCount(10);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={selectedStatusFilter}
            onValueChange={(val) => {
              setSelectedStatusFilter(val);
              setVisibleCount(10);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="lowStock">Low Stock (≤5)</SelectItem>
              <SelectItem value="expiringSoon">Expiring Soon (30d)</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title-asc">Title: A to Z</SelectItem>
              <SelectItem value="title-desc">Title: Z to A</SelectItem>
              <SelectItem value="stock-asc">Stock: Low to High</SelectItem>
              <SelectItem value="stock-desc">Stock: High to Low</SelectItem>
              {!isStockMode && <SelectItem value="group-asc">Medicine Group: A-Z</SelectItem>}
              <SelectItem value="company-asc">Company Name: A-Z</SelectItem>
              <SelectItem value="expiry-asc">Expiry Date: Soonest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm bg-muted/20 p-2.5 rounded-lg border border-dashed">
        <span className="text-muted-foreground font-medium mr-1">Quick Sort:</span>
        {!isStockMode && (
          <Button
            variant={sortBy === 'group-asc' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full h-8 px-3.5 text-xs font-semibold"
            onClick={() => setSortBy(sortBy === 'group-asc' ? 'title-asc' : 'group-asc')}
          >
            By Group (Generic)
          </Button>
        )}
        <Button
          variant={sortBy === 'company-asc' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full h-8 px-3.5 text-xs font-semibold"
          onClick={() => setSortBy(sortBy === 'company-asc' ? 'title-asc' : 'company-asc')}
        >
          By Company / Manufacturer
        </Button>
      </div>
    </>
  );
}
