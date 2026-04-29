export type SupabasePublicConfig = {
  url: string;
  key: string;
};

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase não configurado. Configure as variáveis de ambiente.';

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return { url, key };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  return config;
}
