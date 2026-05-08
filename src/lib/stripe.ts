import 'server-only';

import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeEnvStatus() {
  return {
    hasStripeSecretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    hasStripePrice: Boolean(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY),
    hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) return null;

  stripeClient ??= new Stripe(secretKey, {
    typescript: true,
  });

  return stripeClient;
}

export function getStripePriceId() {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || null;
}

export function getConfiguredAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null;
}

export function getAppUrl(request?: Request) {
  const configuredUrl = getConfiguredAppUrl();

  if (configuredUrl) return configuredUrl;
  if (request) return new URL(request.url).origin;

  return 'http://localhost:3000';
}
