import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/src/lib/supabase/server';
import { getAppUrl, getStripe } from '@/src/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json({ error: 'Pagamentos ainda não configurados.' }, { status: 503 });
  }

  const supabase = await getServerSupabase();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Faça login para gerenciar sua assinatura.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Não foi possível carregar sua assinatura.' }, { status: 500 });
  }

  const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl(request)}/pro`,
  });

  return NextResponse.json({ url: portal.url });
}
