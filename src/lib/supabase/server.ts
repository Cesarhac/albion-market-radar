import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabasePublicConfig } from '@/src/lib/supabase/env';

export async function getServerSupabase() {
  const config = getSupabasePublicConfig();

  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always set cookies; auth refresh still works in Route Handlers.
        }
      },
    },
  });
}
