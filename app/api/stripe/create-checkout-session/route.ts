import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/src/lib/supabase/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getAppUrl, getStripe, getStripePriceId } from '@/src/lib/stripe';
import { isUserPro } from '@/src/lib/entitlements';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/albion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAYMENTS_NOT_CONFIGURED = 'Pagamentos ainda não configurados.';

type ProfileRow = {
  id: string;
  email: string | null;
  player_name: string | null;
  plan: SubscriptionPlan | null;
  subscription_status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
  subscription_current_period_end: string | null;
};

export async function POST(request: Request) {
  const stripe = getStripe();
  const priceId = getStripePriceId();
  const admin = getSupabaseAdmin();

  if (!stripe || !priceId || !admin) {
    return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 });
  }

  const supabase = await getServerSupabase();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Faça login para assinar o PRO.' }, { status: 401 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, player_name, plan, subscription_status, stripe_customer_id, subscription_current_period_end')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Não foi possível carregar seu perfil.' }, { status: 500 });
  }

  const profile = profileData as ProfileRow | null;

  if (
    isUserPro({
      plan: profile?.plan === 'pro' ? 'pro' : 'free',
      subscriptionStatus: profile?.subscription_status ?? 'free',
      subscriptionCurrentPeriodEnd: profile?.subscription_current_period_end ?? undefined,
    })
  ) {
    return NextResponse.json({ error: 'Você já está no PRO.' }, { status: 400 });
  }

  const playerName =
    profile?.player_name ??
    (typeof authData.user.user_metadata?.player_name === 'string' ? authData.user.user_metadata.player_name : '') ??
    '';
  const email = profile?.email ?? authData.user.email ?? undefined;
  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: playerName || undefined,
      metadata: {
        supabaseUserId: authData.user.id,
        playerName,
      },
    });

    customerId = customer.id;

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Não foi possível preparar a assinatura.' }, { status: 500 });
    }
  }

  const metadata = {
    supabaseUserId: authData.user.id,
    playerName,
    product: 'pro_monthly',
  };
  const appUrl = getAppUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/pro?checkout=success`,
    cancel_url: `${appUrl}/pro?checkout=cancelled`,
    metadata,
    subscription_data: {
      metadata,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Não foi possível criar o checkout.' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
