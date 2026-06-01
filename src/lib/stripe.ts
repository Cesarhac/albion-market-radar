import 'server-only';

import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeEnvStatus() {
  return {
    hasStripeSecretKey: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    hasStripePrice: Boolean(getStripePriceId()),
    hasAppUrl: Boolean(getConfiguredAppUrl()),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  };
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) return null;

  stripeClient ??= new Stripe(secretKey, {
    typescript: true,
  });

  return stripeClient;
}

export function getStripePriceId() {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY?.trim() || null;
}

export function getConfiguredAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || null;
}

export function getAppUrl(request?: Request) {
  const configuredUrl = getConfiguredAppUrl();

  if (configuredUrl) return configuredUrl;
  if (request) return new URL(request.url).origin;

  return 'http://localhost:3000';
}
