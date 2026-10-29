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
import { useStoreType } from '@/hooks/use-store-type';

interface ExpiryFiltersHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (val: string) => void;
  companies: string[];
  selectedCompanyFilter: string;
  setSelectedCompanyFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  setVisibleCount: (count: number) => void;
}

export function ExpiryFiltersHeader({
  searchQuery,
  setSearchQuery,
  selectedStatusFilter,
  setSelectedStatusFilter,
  companies,
  selectedCompanyFilter,
  setSelectedCompanyFilter,
  sortBy,
  setSortBy,
  setVisibleCount,
}: ExpiryFiltersHeaderProps) {
  const { isPharmacy } = useStoreType();
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={
            isPharmacy
              ? 'Search items by name, group, manufacturer...'
              : 'Search items by name, manufacturer...'
          }
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
          value={selectedStatusFilter}
          onValueChange={(val) => {
            setSelectedStatusFilter(val);
            setVisibleCount(10);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expiring90d">Expiring in 90 Days</SelectItem>
            <SelectItem value="expiring60d">Expiring in 60 Days</SelectItem>
            <SelectItem value="expiring30d">Expiring in 30 Days</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="all">All Expiry Alerts</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedCompanyFilter}
          onValueChange={(val) => {
            setSelectedCompanyFilter(val);
            setVisibleCount(10);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expiry-asc">Expiry: Soonest First</SelectItem>
            <SelectItem value="expiry-desc">Expiry: Latest First</SelectItem>
            <SelectItem value="title-asc">Title: A to Z</SelectItem>
            {isPharmacy && <SelectItem value="group-asc">Medicine Group: A-Z</SelectItem>}
            <SelectItem value="company-asc">Company Name: A-Z</SelectItem>
            <SelectItem value="stock-asc">Stock: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
