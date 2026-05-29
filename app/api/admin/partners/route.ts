import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getServerSupabase } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

type PartnerRow = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  promotion_code: string;
  active: boolean;
  commission_type: string | null;
  commission_value: number | null;
  created_at: string;
  updated_at: string;
};

type RedemptionRow = {
  id: string;
  streamer_partner_id: string | null;
  user_id: string | null;
  email: string | null;
  promotion_code: string;
  stripe_subscription_id: string | null;
  amount_subtotal: number | null;
  amount_total: number | null;
  amount_discount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string;
};

type PartnerSummary = PartnerRow & {
  totalUses: number;
  activeSubscriptions: number;
  revenueTotal: number;
  discountTotal: number;
  lastUse: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function GET() {
  const supabase = await getServerSupabase();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
  }

  if (!isAdminEmail(authData.user.email)) {
    return NextResponse.json({ error: 'Acesso administrativo não autorizado.' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 503 });
  }

  let partners: PartnerRow[] = [];
  let redemptions: RedemptionRow[] = [];

  try {
    const [{ data: partnersData, error: partnersError }, fetchedRedemptions] = await Promise.all([
      admin
        .from('streamer_partners')
        .select('id, name, slug, email, promotion_code, active, commission_type, commission_value, created_at, updated_at')
        .order('name', { ascending: true }),
      fetchAllRedemptions(admin),
    ]);

    if (partnersError) {
      return NextResponse.json({ error: partnersError.message }, { status: 500 });
    }

    partners = (partnersData ?? []) as PartnerRow[];
    redemptions = fetchedRedemptions;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível carregar parceiros.' },
      { status: 500 },
    );
  }

  const partnerSummaries = buildPartnerSummaries(partners, redemptions);
  const partnerNameById = new Map(partners.map((partner) => [partner.id, partner.name]));
  const recentRedemptions = redemptions.slice(0, 50).map((redemption) => ({
    id: redemption.id,
    createdAt: redemption.created_at,
    userId: redemption.user_id,
    email: redemption.email,
    promotionCode: redemption.promotion_code,
    streamerName: redemption.streamer_partner_id
      ? partnerNameById.get(redemption.streamer_partner_id) ?? 'Parceiro não encontrado'
      : 'Sem parceiro cadastrado',
    amountTotal: redemption.amount_total ?? 0,
    amountSubtotal: redemption.amount_subtotal ?? 0,
    amountDiscount: redemption.amount_discount ?? 0,
    currency: redemption.currency ?? 'brl',
    status: redemption.status ?? 'desconhecido',
  }));

  return NextResponse.json({
    partners: partnerSummaries,
    recentRedemptions,
  });
}

async function fetchAllRedemptions(admin: SupabaseAdmin): Promise<RedemptionRow[]> {
  const pageSize = 1000;
  const redemptions: RedemptionRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('streamer_coupon_redemptions')
      .select(
        'id, streamer_partner_id, user_id, email, promotion_code, stripe_subscription_id, amount_subtotal, amount_total, amount_discount, currency, status, created_at',
      )
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = (data ?? []) as RedemptionRow[];

    redemptions.push(...rows);

    if (rows.length < pageSize) break;
  }

  return redemptions;
}

function buildPartnerSummaries(partners: PartnerRow[], redemptions: RedemptionRow[]): PartnerSummary[] {
  const stats = new Map<
    string,
    {
      totalUses: number;
      activeSubscriptionIds: Set<string>;
      revenueTotal: number;
      discountTotal: number;
      lastUse: string | null;
    }
  >();

  for (const partner of partners) {
    stats.set(partner.id, {
      totalUses: 0,
      activeSubscriptionIds: new Set(),
      revenueTotal: 0,
      discountTotal: 0,
      lastUse: null,
    });
  }

  for (const redemption of redemptions) {
    if (!redemption.streamer_partner_id) continue;

    const partnerStats = stats.get(redemption.streamer_partner_id);

    if (!partnerStats) continue;

    partnerStats.totalUses += 1;
    partnerStats.revenueTotal += redemption.amount_total ?? 0;
    partnerStats.discountTotal += redemption.amount_discount ?? 0;

    if (redemption.status && ACTIVE_SUBSCRIPTION_STATUSES.has(redemption.status)) {
      partnerStats.activeSubscriptionIds.add(redemption.stripe_subscription_id ?? redemption.id);
    }

    if (!partnerStats.lastUse || redemption.created_at > partnerStats.lastUse) {
      partnerStats.lastUse = redemption.created_at;
    }
  }

  return partners.map((partner) => {
    const partnerStats = stats.get(partner.id);

    return {
      ...partner,
      totalUses: partnerStats?.totalUses ?? 0,
      activeSubscriptions: partnerStats?.activeSubscriptionIds.size ?? 0,
      revenueTotal: partnerStats?.revenueTotal ?? 0,
      discountTotal: partnerStats?.discountTotal ?? 0,
      lastUse: partnerStats?.lastUse ?? null,
    };
  });
}

function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;

  const adminEmails = getAdminEmails();

  if (adminEmails.size === 0) return false;

  return adminEmails.has(email.trim().toLowerCase());
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';

  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
