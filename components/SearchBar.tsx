'use client';

import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  className?: string;
  placeholder?: string;
  isLoading?: boolean;
  initialValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function SearchBar({
  onSearch,
  className,
  placeholder = 'Buscar item, ex: Dessangra, Mochila, T4_BAG...',
  isLoading = false,
  initialValue = '',
  value,
  onValueChange,
}: SearchBarProps) {
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState(initialValue);
  const query = value ?? uncontrolledQuery;

  const setQuery = (nextValue: string) => {
    if (value === undefined) {
      setUncontrolledQuery(nextValue);
    }

    onValueChange?.(nextValue);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery.length > 0) {
      onSearch?.(nextQuery);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('w-full', className)}>
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-zinc-950/80 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.32)] focus-within:border-brand-primary/70 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="absolute left-3 text-zinc-500">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </span>
          <span className="sr-only">Buscar item</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="min-h-12 w-full rounded-md bg-transparent pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-md bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || query.trim().length === 0}
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
