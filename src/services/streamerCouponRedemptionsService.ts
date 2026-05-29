import 'server-only';

import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type PromotionCodeAttribution = {
  id: string;
  code: string;
  couponId: string | null;
};

type StreamerPartnerRow = {
  id: string;
  name: string;
  promotion_code: string;
  stripe_promotion_code_id: string | null;
  stripe_coupon_id: string | null;
  active: boolean;
};

type RecordRedemptionResult = {
  recorded: boolean;
  reason?: 'no_promotion_code' | 'supabase_admin_unavailable';
  partnerId?: string | null;
  promotionCode?: string;
};

export async function getPromotionCodeFromCheckoutSession(
  stripe: Stripe,
  sessionId: string,
  fallbackSession?: Stripe.Checkout.Session,
  fallbackSubscription?: Stripe.Subscription | null,
): Promise<PromotionCodeAttribution | null> {
  const expandedSession = await retrieveCheckoutSessionWithDiscounts(stripe, sessionId, fallbackSession);

  const sessionPromotion =
    (expandedSession ? await findPromotionCodeInCheckoutSession(stripe, expandedSession) : null) ??
    (fallbackSession ? await findPromotionCodeInCheckoutSession(stripe, fallbackSession) : null);

  if (sessionPromotion) return sessionPromotion;

  const subscription =
    fallbackSubscription ??
    (expandedSession ? await retrieveSubscriptionFromCheckoutSession(stripe, expandedSession) : null) ??
    (fallbackSession ? await retrieveSubscriptionFromCheckoutSession(stripe, fallbackSession) : null);

  return subscription ? findPromotionCodeInSubscription(stripe, subscription) : null;
}

export async function findStreamerPartnerByPromotionCode(
  promotion: PromotionCodeAttribution,
  admin: SupabaseAdmin = requireSupabaseAdmin(),
): Promise<StreamerPartnerRow | null> {
  const byStripeId = await maybeGetPartner(admin, 'stripe_promotion_code_id', promotion.id);

  if (byStripeId) return byStripeId;

  const codeCandidates = uniqueStrings([promotion.code, promotion.code.toUpperCase(), promotion.code.toLowerCase()]);

  for (const code of codeCandidates) {
    const byCode = await maybeGetPartner(admin, 'promotion_code', code);
    if (byCode) return byCode;
  }

  return null;
}

export async function recordStreamerCouponRedemption(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  options: { subscription?: Stripe.Subscription | null } = {},
): Promise<RecordRedemptionResult> {
  const admin = getSupabaseAdmin();

  if (!admin) return { recorded: false, reason: 'supabase_admin_unavailable' };

  const promotion = await getPromotionCodeFromCheckoutSession(stripe, session.id, session, options.subscription ?? null);

  if (!promotion) return { recorded: false, reason: 'no_promotion_code' };

  const partner = await findStreamerPartnerByPromotionCode(promotion, admin);
  const subscriptionId = getStripeId(session.subscription) ?? options.subscription?.id ?? null;
  const customerId = getStripeId(session.customer);
  const userId = normalizeUuid(
    session.client_reference_id ?? session.metadata?.supabaseUserId ?? session.metadata?.user_id ?? null,
  );
  const status = options.subscription?.status ?? session.payment_status ?? session.status ?? null;
  const payload: Record<string, unknown> = {
    streamer_partner_id: partner?.id ?? null,
    user_id: userId,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    promotion_code: promotion.code,
    stripe_promotion_code_id: promotion.id,
    stripe_coupon_id: promotion.couponId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_checkout_session_id: session.id,
    amount_subtotal: session.amount_subtotal,
    amount_discount: session.total_details?.amount_discount ?? null,
    amount_total: session.amount_total,
    currency: session.currency,
    status,
  };

  const { error } = await admin
    .from('streamer_coupon_redemptions')
    .upsert(payload, { onConflict: 'stripe_checkout_session_id' });

  if (error) throw error;

  return {
    recorded: true,
    partnerId: partner?.id ?? null,
    promotionCode: promotion.code,
  };
}

export async function updateStreamerRedemptionSubscriptionStatus(
  subscription: Stripe.Subscription,
  statusOverride?: string,
) {
  const admin = getSupabaseAdmin();

  if (!admin) return;

  const { error } = await admin
    .from('streamer_coupon_redemptions')
    .update({ status: statusOverride ?? subscription.status })
    .eq('stripe_subscription_id', subscription.id);

  if (error) throw error;
}

async function retrieveCheckoutSessionWithDiscounts(
  stripe: Stripe,
  sessionId: string,
  fallbackSession?: Stripe.Checkout.Session,
) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['discounts.promotion_code', 'discounts.coupon', 'subscription'],
    });
  } catch (error) {
    console.warn('[stripe coupons] checkout session expansion failed', {
      sessionId,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return fallbackSession ?? null;
  }
}

async function retrieveSubscriptionFromCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const expandedSubscription = isStripeObject(session.subscription, 'subscription')
    ? (session.subscription as Stripe.Subscription)
    : null;

  if (expandedSubscription) return expandedSubscription;

  const subscriptionId = getStripeId(session.subscription);

  if (!subscriptionId) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['discounts', 'discounts.promotion_code'],
    });
  } catch (error) {
    console.warn('[stripe coupons] subscription expansion failed', {
      subscriptionId,
      message: error instanceof Error ? error.message : 'unknown error',
    });

    return null;
  }
}

async function findPromotionCodeInCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  for (const discount of session.discounts ?? []) {
    const promotion = await resolvePromotionCode(stripe, discount.promotion_code);

    if (promotion) {
      return {
        ...promotion,
        couponId: promotion.couponId ?? getStripeId(discount.coupon),
      };
    }
  }

  const breakdownDiscounts = getCheckoutBreakdownDiscounts(session);

  for (const breakdownDiscount of breakdownDiscounts) {
    const discount = getRecordValue(breakdownDiscount, 'discount');
    const promotion = await findPromotionCodeInDiscountObject(stripe, discount);

    if (promotion) return promotion;
  }

  return null;
}

async function findPromotionCodeInSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  for (const discount of subscription.discounts ?? []) {
    const promotion = await findPromotionCodeInDiscountObject(stripe, discount);

    if (promotion) return promotion;
  }

  return null;
}

async function findPromotionCodeInDiscountObject(stripe: Stripe, discount: unknown) {
  if (typeof discount === 'string') return null;

  const promotionCode = getRecordValue(discount, 'promotion_code');

  return resolvePromotionCode(stripe, promotionCode);
}

async function resolvePromotionCode(stripe: Stripe, promotionCode: unknown): Promise<PromotionCodeAttribution | null> {
  if (!promotionCode) return null;

  if (typeof promotionCode === 'string') {
    try {
      const expanded = await stripe.promotionCodes.retrieve(promotionCode, {
        expand: ['promotion.coupon'],
      });

      return promotionCodeFromObject(expanded);
    } catch (error) {
      console.warn('[stripe coupons] promotion code lookup failed', {
        promotionCodeId: promotionCode,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return {
        id: promotionCode,
        code: promotionCode,
        couponId: null,
      };
    }
  }

  return promotionCodeFromObject(promotionCode);
}

function promotionCodeFromObject(value: unknown): PromotionCodeAttribution | null {
  const record = asRecord(value);
  const id = getString(record?.id);

  if (!id) return null;

  return {
    id,
    code: getString(record?.code) ?? id,
    couponId: getPromotionCouponId(record),
  };
}

function getPromotionCouponId(promotionCode: Record<string, unknown> | null) {
  const promotion = asRecord(promotionCode?.promotion);

  return getStripeId(promotion?.coupon);
}

function getCheckoutBreakdownDiscounts(session: Stripe.Checkout.Session) {
  const totalDetails = asRecord(session.total_details);
  const breakdown = asRecord(totalDetails?.breakdown);
  const discounts = breakdown?.discounts;

  return Array.isArray(discounts) ? discounts : [];
}

async function maybeGetPartner(admin: SupabaseAdmin, column: string, value: string | null | undefined) {
  if (!value) return null;

  const { data, error } = await admin
    .from('streamer_partners')
    .select('id, name, promotion_code, stripe_promotion_code_id, stripe_coupon_id, active')
    .eq(column, value)
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;

  return (data as StreamerPartnerRow | null) ?? null;
}

function requireSupabaseAdmin(): SupabaseAdmin {
  const admin = getSupabaseAdmin();

  if (!admin) throw new Error('Supabase admin não configurado.');

  return admin;
}

function normalizeUuid(value: string | null | undefined) {
  if (!value) return null;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function getStripeId(value: unknown): string | null {
  if (typeof value === 'string') return value;

  return getString(asRecord(value)?.id);
}

function isStripeObject(value: unknown, objectName: string) {
  return getString(asRecord(value)?.object) === objectName;
}

function getRecordValue(value: unknown, key: string): unknown {
  return asRecord(value)?.[key];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}
