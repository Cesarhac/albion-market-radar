import { ensureSupabaseClient } from '@/src/lib/supabase/database';
import { serverToParam } from '@/lib/marketData';
import { serverParamToRegion } from '@/lib/settingsStorage';
import type { ServerParam, ServerRegion } from '@/types/albion';
import type { RegearSlotForm } from '@/types/regear';

export type SavedRegearBuild = {
  id: string;
  userId: string;
  name: string;
  server: ServerRegion;
  items: RegearSlotForm[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SavedRegearBuildRow = {
  id: string;
  user_id: string;
  name: string;
  server: ServerParam;
  items: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export async function listRegearBuilds(userId: string): Promise<SavedRegearBuild[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('saved_regear_builds')
    .select('id, user_id, name, server, items, notes, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as SavedRegearBuildRow[]).map(rowToSavedRegearBuild);
}

export async function fetchSavedRegearBuilds(): Promise<SavedRegearBuild[]> {
  return listRegearBuilds(await getAuthenticatedUserId());
}

export async function createRegearBuild(input: {
  name: string;
  server: ServerRegion;
  items: RegearSlotForm[];
  notes?: string;
}): Promise<SavedRegearBuild> {
  const supabase = ensureSupabaseClient();
  const userId = await getAuthenticatedUserId();
  const payload = {
    user_id: userId,
    name: input.name,
    server: serverToParam(input.server),
    items: input.items.length > 0 ? input.items : {},
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
  const { data, error } = await supabase
    .from('saved_regear_builds')
    .insert(payload)
    .select('id, user_id, name, server, items, notes, created_at, updated_at')
    .single();

  if (error) {
    logRegearBuildSupabaseError('create', error, payload);
    throw new Error(formatRegearBuildError(error, 'Erro ao salvar build'));
  }

  return rowToSavedRegearBuild(data as SavedRegearBuildRow);
}

export const createSavedRegearBuild = createRegearBuild;

export async function updateRegearBuild(buildId: string, input: {
  name?: string;
  server?: ServerRegion;
  items?: RegearSlotForm[];
  notes?: string;
}): Promise<SavedRegearBuild> {
  const supabase = ensureSupabaseClient();
  const userId = await getAuthenticatedUserId();
  const payload = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.server !== undefined ? { server: serverToParam(input.server) } : {}),
    ...(input.items !== undefined ? { items: input.items.length > 0 ? input.items : {} } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('saved_regear_builds')
    .update(payload)
    .eq('id', buildId)
    .eq('user_id', userId)
    .select('id, user_id, name, server, items, notes, created_at, updated_at')
    .single();

  if (error) {
    logRegearBuildSupabaseError('update', error, { buildId, user_id: userId, ...payload });
    throw new Error(formatRegearBuildError(error, 'Erro ao salvar build'));
  }

  return rowToSavedRegearBuild(data as SavedRegearBuildRow);
}

export const updateSavedRegearBuild = updateRegearBuild;

export async function deleteRegearBuild(buildId: string) {
  const supabase = ensureSupabaseClient();
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase
    .from('saved_regear_builds')
    .delete()
    .eq('id', buildId)
    .eq('user_id', userId);

  if (error) throw error;
}

export const deleteSavedRegearBuild = deleteRegearBuild;

export async function findRegearBuildByName(userId: string, name: string): Promise<SavedRegearBuild | null> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('saved_regear_builds')
    .select('id, user_id, name, server, items, notes, created_at, updated_at')
    .eq('user_id', userId)
    .eq('name', name.trim())
    .maybeSingle();

  if (error) throw error;

  return data ? rowToSavedRegearBuild(data as SavedRegearBuildRow) : null;
}

export const findRegearBuildByNameForUser = findRegearBuildByName;

function rowToSavedRegearBuild(row: SavedRegearBuildRow): SavedRegearBuild {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    server: serverParamToRegion(row.server),
    items: Array.isArray(row.items) ? row.items as RegearSlotForm[] : [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(formatRegearBuildError(error, 'Erro ao confirmar usuário autenticado'));
  if (!data.user?.id) throw new Error('Erro ao salvar build: usuário autenticado não encontrado.');

  return data.user.id;
}

function logRegearBuildSupabaseError(operation: 'create' | 'update', error: unknown, payload: unknown) {
  if (process.env.NODE_ENV === 'production') return;

  const supabaseError = toSupabaseError(error);

  console.error('[saveRegearBuild] Supabase error:', {
    operation,
    message: supabaseError?.message,
    details: supabaseError?.details,
    hint: supabaseError?.hint,
    code: supabaseError?.code,
    payload,
  });
}

function formatRegearBuildError(error: unknown, fallback: string): string {
  const supabaseError = toSupabaseError(error);

  if (!supabaseError) return error instanceof Error ? error.message : fallback;
  if (process.env.NODE_ENV === 'production') return fallback;

  return [
    `${fallback}: ${supabaseError.message}`,
    supabaseError.code ? `code=${supabaseError.code}` : '',
    supabaseError.details ? `details=${supabaseError.details}` : '',
    supabaseError.hint ? `hint=${supabaseError.hint}` : '',
  ].filter(Boolean).join(' | ');
}

function toSupabaseError(error: unknown): {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null {
  if (!error || typeof error !== 'object') return null;

  const candidate = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  return {
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    details: typeof candidate.details === 'string' ? candidate.details : undefined,
    hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
  };
}
