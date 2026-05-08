import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getServerSupabase } from '@/src/lib/supabase/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getAppUrl, getStripe } from '@/src/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripe = getStripe();

  if (!stripe) {
    console.error('[stripe portal] missing STRIPE_SECRET_KEY');
    return NextResponse.json({ error: 'Stripe não configurado.' }, { status: 500 });
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    console.error('[stripe portal] missing Supabase admin env');
    return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 503 });
  }

  const authResult = await getAuthenticatedUser(request);
  if ('response' in authResult) return authResult.response;

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', authResult.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[stripe portal] profile lookup failed', {
      userId: authResult.user.id,
      message: profileError.message,
    });
    return NextResponse.json({ error: 'Não foi possível carregar sua assinatura.' }, { status: 500 });
  }

  const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json({ error: 'Nenhuma assinatura Stripe vinculada a esta conta.' }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl(request)}/pro`,
  });

  return NextResponse.json({ url: portal.url });
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

async function getAuthenticatedUser(request: Request): Promise<{ user: User } | { response: NextResponse }> {
  const supabase = await getServerSupabase();

  if (!supabase) {
    return { response: NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 }) };
  }

  const token = getBearerToken(request);
  const { data, error } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { error: token ? 'Sessão inválida ou expirada.' : 'Usuário não autenticado.' },
        { status: 401 },
      ),
    };
  }

  return { user: data.user };
}
