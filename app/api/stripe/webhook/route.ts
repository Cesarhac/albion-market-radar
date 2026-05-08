import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getStripe } from '@/src/lib/stripe';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/albion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRO_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing', 'past_due']);

type ProfileUpdate = {
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean;
  subscription_cancel_at?: string | null;
  updated_at: string;
};

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = getSupabaseAdmin();

  if (!stripe) {
    console.error('[stripe webhook] missing STRIPE_SECRET_KEY');
    return NextResponse.json({ error: 'Stripe não configurado.' }, { status: 500 });
  }

  if (!webhookSecret) {
    console.error('[stripe webhook] missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook Stripe não configurado.' }, { status: 500 });
  }

  if (!admin) {
    console.error('[stripe webhook] missing Supabase admin env');
    return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Assinatura do webhook ausente.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await updateProfileFromSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await updateProfileFromSubscription(event.data.object as Stripe.Subscription, {
          forcePlan: 'free',
          forceStatus: 'canceled',
        });
        break;
      case 'invoice.paid':
        await handleInvoicePaid(stripe, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar webhook.';

    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return;

  const subscriptionId = getStripeId(session.subscription);
  const customerId = getStripeId(session.customer);
  const supabaseUserId = session.metadata?.supabaseUserId;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await updateProfileFromSubscription(subscription, { supabaseUserId, customerId });
    return;
  }

  if (!supabaseUserId) return;

  await updateProfileByUserId(supabaseUserId, {
    plan: 'pro',
    subscription_status: 'active',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_cancel_at_period_end: false,
    subscription_cancel_at: null,
    updated_at: new Date().toISOString(),
  });
}

async function handleInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await updateProfileFromSubscription(subscription);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const customerId = getStripeId(invoice.customer);

  await updateProfileBySubscriptionOrCustomer(subscriptionId, customerId, {
    plan: 'pro',
    subscription_status: 'past_due',
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    updated_at: new Date().toISOString(),
  });
}

async function updateProfileFromSubscription(
  subscription: Stripe.Subscription,
  options: {
    supabaseUserId?: string;
    customerId?: string | null;
    forcePlan?: SubscriptionPlan;
    forceStatus?: SubscriptionStatus;
  } = {},
) {
  const status = options.forceStatus ?? normalizeStripeSubscriptionStatus(subscription.status);
  const plan = options.forcePlan ?? (PRO_STATUSES.has(status) ? 'pro' : 'free');
  const customerId = options.customerId ?? getStripeId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const isDeleted = options.forceStatus === 'canceled';
  const cancelAtPeriodEnd = !isDeleted && Boolean(subscription.cancel_at_period_end);
  const cancelAt = isDeleted ? null : getSubscriptionCancelAt(subscription);
  const payload: ProfileUpdate = {
    plan,
    subscription_status: status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: cancelAtPeriodEnd,
    subscription_cancel_at: cancelAt,
    updated_at: new Date().toISOString(),
  };

  if (options.supabaseUserId) {
    await updateProfileByUserId(options.supabaseUserId, payload);
    return;
  }

  await updateProfileBySubscriptionOrCustomer(subscription.id, customerId, payload);
}

async function updateProfileByUserId(userId: string, payload: Partial<ProfileUpdate>) {
  const admin = getSupabaseAdmin();

  if (!admin) throw new Error('Supabase admin não configurado.');

  const { error } = await admin.from('profiles').update(payload).eq('id', userId);

  if (error) throw error;
}

async function updateProfileBySubscriptionOrCustomer(
  subscriptionId: string | null,
  customerId: string | null,
  payload: Partial<ProfileUpdate>,
) {
  const admin = getSupabaseAdmin();

  if (!admin) throw new Error('Supabase admin não configurado.');

  if (subscriptionId) {
    const { data, error } = await admin
      .from('profiles')
      .update(payload)
      .eq('stripe_subscription_id', subscriptionId)
      .select('id');

    if (error) throw error;
    if ((data ?? []).length > 0) return;
  }

  if (customerId) {
    const { error } = await admin.from('profiles').update(payload).eq('stripe_customer_id', customerId);

    if (error) throw error;
  }
}

function normalizeStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete' ||
    status === 'incomplete_expired' ||
    status === 'paused'
  ) {
    return status;
  }

  return 'inactive';
}

function getStripeId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;

  return null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const timestamp = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;

  if (!timestamp) return null;

  return new Date(timestamp * 1000).toISOString();
}

function getSubscriptionCancelAt(subscription: Stripe.Subscription): string | null {
  const candidate = subscription as Stripe.Subscription & {
    cancel_at?: number | null;
    current_period_end?: number;
  };
  const timestamp = candidate.cancel_at ?? (subscription.cancel_at_period_end ? candidate.current_period_end : null);

  if (!timestamp) return null;

  return new Date(timestamp * 1000).toISOString();
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const candidate = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string } | null;
      } | null;
    } | null;
  };

  return getStripeId(candidate.subscription) ?? getStripeId(candidate.parent?.subscription_details?.subscription);
}
