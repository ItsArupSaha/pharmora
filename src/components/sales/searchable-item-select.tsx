'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStoreType } from '@/hooks/use-store-type';
import type { Item } from '@/lib/types';
import { filterAndSortItems } from './searchable-item-utils';

interface SearchableItemSelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  disabledItemIds: string[];
}

export function SearchableItemSelect({
  items,
  value,
  onChange,
  disabledItemIds,
  placeholder = 'Select item',
  className,
  ...props
}: SearchableItemSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const { isPharmacy } = useStoreType();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Find current selected item
  const selectedItem = React.useMemo(() => {
    return items.find((item) => item.id === value);
  }, [items, value]);

  const selectedItemRef = React.useRef(selectedItem);
  React.useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  // Sync searchQuery with value changes
  React.useEffect(() => {
    if (selectedItem) {
      setSearchQuery(selectedItem.title);
    } else {
      setSearchQuery('');
    }
  }, [selectedItem]);

  // Filter items based on searchQuery using utility
  const filteredItems = React.useMemo(() => {
    if (!isOpen) return [];
    return filterAndSortItems({ items, searchQuery, value, disabledItemIds });
  }, [isOpen, items, searchQuery, value, disabledItemIds]);

  // Reset highlight index when filter list changes
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  // Scroll highlighted item into view during keyboard navigation
  React.useEffect(() => {
    if (isOpen && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Handle clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery(selectedItem ? selectedItem.title : '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem]);

  const handleSelectItem = (item: Item) => {
    onChange(item.id);
    setSearchQuery(item.title);
    setIsOpen(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // With a selection made, the row shows the full (wrapping) medicine name
  // with its stock beside it; clicking it reopens the search input.
  const showSelectedName = !!selectedItem && !isEditing;

  // Key navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && searchQuery.trim()) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredItems[highlightedIndex]) {
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setSearchQuery(selectedItem ? selectedItem.title : '');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {showSelectedName ? (
        <button
          type="button"
          title="Click to change"
          className={cn(
            'flex w-full min-h-8 items-start justify-between gap-2 px-3 py-1 text-left text-xs font-medium hover:bg-slate-50/50 dark:hover:bg-slate-900/20',
            className
          )}
          onClick={() => {
            setIsEditing(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <span className="min-w-0 break-words leading-snug">{selectedItem.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5">
            ({selectedItem.stock})
          </span>
        </button>
      ) : (
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            setIsOpen(!!val.trim());
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              const currentItem = selectedItemRef.current;
              setSearchQuery(currentItem ? currentItem.title : '');
              if (currentItem) setIsEditing(false);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          className={cn('w-full h-8 px-3 text-sm font-medium', className)}
          {...props}
          ref={inputRef}
        />
      )}
      {isOpen && filteredItems.length > 0 && (
        <div ref={listRef} className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-popover text-popover-foreground border rounded-md shadow-lg p-1">
          {filteredItems.map((item, idx) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              type="button"
              className={`w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors ${
                idx === highlightedIndex ? 'bg-muted text-foreground font-semibold' : 'hover:bg-muted/50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectItem(item);
              }}
              onClick={(e) => {
                e.preventDefault();
                handleSelectItem(item);
              }}
            >
              <div className="font-semibold">{item.title}</div>
              <div className="text-xs text-muted-foreground">
                {item.company}{' '}
                {isPharmacy && item.medicineGroup ? `- ${item.medicineGroup}` : ''}{' '}
                {item.expiryDate ? ` | Exp: ${item.expiryDate}` : ''} | Stock: {item.stock}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
