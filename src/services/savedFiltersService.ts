import { ensureSupabaseClient, isSupabaseConfigured } from '@/src/lib/supabase/database';
import type { OpportunityFilters } from '@/types/albion';

export type SavedFilterPage = 'opportunities' | 'trader';

export type SavedFilter = {
  id: string;
  name: string;
  page: SavedFilterPage;
  filters: OpportunityFilters | Record<string, unknown>;
  createdAt: string;
};

type SavedFilterRow = {
  id: string;
  name: string;
  page: SavedFilterPage;
  filters: unknown;
  created_at: string;
};

const LOCAL_KEY = 'albion-market-radar:saved-filters:v1';

export async function fetchSavedFilters(page: SavedFilterPage): Promise<SavedFilter[]> {
  if (!isSupabaseConfigured()) {
    return readLocalFilters().filter((filter) => filter.page === page);
  }

  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('saved_filters')
    .select('id, name, page, filters, created_at')
    .eq('page', page)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as SavedFilterRow[]).map(rowToSavedFilter);
}

export async function createSavedFilter(input: {
  name: string;
  page: SavedFilterPage;
  filters: SavedFilter['filters'];
}): Promise<SavedFilter> {
  if (!isSupabaseConfigured()) {
    const savedFilter: SavedFilter = {
      id: `local-${Date.now()}`,
      name: input.name,
      page: input.page,
      filters: input.filters,
      createdAt: new Date().toISOString(),
    };
    const nextFilters = [savedFilter, ...readLocalFilters()];

    writeLocalFilters(nextFilters);

    return savedFilter;
  }

  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('saved_filters')
    .insert({
      name: input.name,
      page: input.page,
      filters: input.filters,
    })
    .select('id, name, page, filters, created_at')
    .single();

  if (error) throw error;

  return rowToSavedFilter(data as SavedFilterRow);
}

export async function deleteSavedFilter(filterId: string) {
  if (!isSupabaseConfigured()) {
    writeLocalFilters(readLocalFilters().filter((filter) => filter.id !== filterId));
    return;
  }

  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('saved_filters').delete().eq('id', filterId);

  if (error) throw error;
}

function rowToSavedFilter(row: SavedFilterRow): SavedFilter {
  return {
    id: row.id,
    name: row.name,
    page: row.page,
    filters: isRecord(row.filters) ? row.filters : {},
    createdAt: row.created_at,
  };
}

function readLocalFilters(): SavedFilter[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(LOCAL_KEY);

    if (!rawValue) return [];

    return JSON.parse(rawValue) as SavedFilter[];
  } catch {
    return [];
  }
}

function writeLocalFilters(filters: SavedFilter[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(filters));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
