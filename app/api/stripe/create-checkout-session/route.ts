import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getServerSupabase } from '@/src/lib/supabase/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getConfiguredAppUrl, getStripe, getStripeEnvStatus, getStripePriceId } from '@/src/lib/stripe';
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
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
};

export async function POST(request: Request) {
  console.log('[stripe env check]', getStripeEnvStatus());

  const stripe = getStripe();
  const priceId = getStripePriceId();
  const appUrl = getConfiguredAppUrl();

  if (!stripe) {
    console.error('[stripe checkout] missing STRIPE_SECRET_KEY');
    return NextResponse.json({ error: 'Stripe não configurado.' }, { status: 500 });
  }

  if (!priceId) {
    console.error('[stripe checkout] missing NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY');
    return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 });
  }

  if (!appUrl) {
    console.error('[stripe checkout] missing NEXT_PUBLIC_APP_URL');
    return NextResponse.json({ error: PAYMENTS_NOT_CONFIGURED }, { status: 503 });
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    console.error('[stripe checkout] missing Supabase admin env');
    return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 503 });
  }

  const authResult = await getAuthenticatedUser(request);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  const { data: profileData, error: profileError } = await admin
    .from('profiles')
    .select('id, email, player_name, plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[stripe checkout] profile lookup failed', {
      userId: user.id,
      message: profileError.message,
    });
    return NextResponse.json({ error: 'Não foi possível carregar seu perfil.' }, { status: 500 });
  }

  const profile = profileData as ProfileRow | null;

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });
  }

  if (profile.stripe_subscription_id && isSubscriptionStillActive(profile.subscription_status)) {
    return NextResponse.json(
      {
        error: 'Você já possui uma assinatura ativa.',
        action: 'customer_portal',
      },
      { status: 409 },
    );
  }

  if (
    isUserPro({
      plan: profile.plan === 'pro' ? 'pro' : 'free',
      subscriptionStatus: profile.subscription_status ?? 'free',
      subscriptionCurrentPeriodEnd: profile.subscription_current_period_end ?? undefined,
    })
  ) {
    return NextResponse.json({ error: 'Você já está no PRO.' }, { status: 400 });
  }

  const playerName =
    profile.player_name ??
    (typeof user.user_metadata?.player_name === 'string' ? user.user_metadata.player_name : '') ??
    '';
  const email = profile.email ?? user.email ?? undefined;
  let customerId = profile.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: playerName || undefined,
      metadata: {
        supabaseUserId: user.id,
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
      .eq('id', user.id);

    if (updateError) {
      console.error('[stripe checkout] customer save failed', {
        userId: user.id,
        message: updateError.message,
      });
      return NextResponse.json({ error: 'Não foi possível preparar a assinatura.' }, { status: 500 });
    }
  }

  const metadata = {
    supabaseUserId: user.id,
    playerName,
    product: 'pro_monthly',
  };

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

function isSubscriptionStillActive(status: SubscriptionStatus | null): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}
