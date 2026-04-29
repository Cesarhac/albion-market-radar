'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicConfig } from '@/src/lib/supabase/env';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserSupabaseClient | null = null;

export function getBrowserSupabase() {
  const config = getSupabasePublicConfig();

  if (!config) return null;

  browserClient ??= createBrowserClient(config.url, config.key);

  return browserClient;
}
