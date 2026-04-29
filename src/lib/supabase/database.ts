import type { RealtimePostgresInsertPayload, User } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/src/lib/supabase/client';
import { SUPABASE_NOT_CONFIGURED_MESSAGE } from '@/src/lib/supabase/env';
import type {
  AlbionCity,
  FavoriteItem,
  ListingStatus,
  Quality,
  ServerParam,
  ServerRegion,
  SubscriptionPlan,
  SubscriptionStatus,
  Tier,
  UserAccount,
  Weapon4Listing,
  Weapon4ListingType,
  WeaponUseCase,
} from '@/types/albion';
import type { UserSettings } from '@/types/settings';
import type { NewTraderOperation, TraderOperation } from '@/types/trader';
import { DEFAULT_USER_SETTINGS, mergeWithDefaultSettings, serverParamToRegion } from '@/lib/settingsStorage';

type ProfileRow = {
  id: string;
  email: string | null;
  player_name: string;
  player_id: string | null;
  guild_name: string | null;
  alliance_name: string | null;
  main_server: ServerParam;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string | null;
};

type UserSettingsRow = {
  default_server: ServerParam;
  market_tax: number;
  main_city: Exclude<AlbionCity, 'Black Market'> | null;
  update_interval_minutes: number | null;
  currency: 'prata' | null;
};

type TraderOperationRow = {
  id: string;
  type: 'buy' | 'sell';
  item_name: string;
  item_id: string | null;
  server: ServerParam | null;
  city: AlbionCity | null;
  unit_buy_price: number | null;
  unit_sell_price: number | null;
  unit_price: number | null;
  quantity: number;
  tax_rate: number | null;
  related_buy_id: string | null;
  related_position_key: string | null;
  is_quick_sale: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

type FavoriteRow = {
  id: string;
  item_id: string;
  item_name: string;
  server: ServerParam | null;
  target_price: number | null;
  city: AlbionCity | null;
  alert_enabled: boolean | null;
  created_at: string;
};

type WeaponListingRow = {
  id: string;
  user_id: string;
  seller_player_name: string;
  seller_player_id: string | null;
  weapon_name: string;
  item_id: string | null;
  tier: number;
  enchantment: number;
  quality: Quality | null;
  server: ServerRegion;
  city: AlbionCity | null;
  asking_price: number;
  status: ListingStatus;
  is_awakened: boolean | null;
  traits: unknown;
  suggested_use: string | null;
  description: string | null;
  seller_contact: string | null;
  safety_accepted_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ChatChannel = 'Global' | 'Américas' | 'Europa' | 'Mercado' | 'Armas .4' | 'Regear' | 'Dúvidas';

export type ChatMessage = {
  id: string;
  userId: string;
  playerName: string;
  channel: ChatChannel;
  content: string;
  status: 'visible' | 'reported';
  createdAt: string;
};

type ChatMessageRow = {
  id: string;
  user_id: string;
  player_name: string;
  channel: ChatChannel;
  content: string;
  status: 'visible' | 'reported';
  created_at: string;
};

export function isSupabaseConfigured() {
  return Boolean(getBrowserSupabase());
}

export function ensureSupabaseClient() {
  const supabase = getBrowserSupabase();

  if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);

  return supabase;
}

export function profileRowToUser(row: ProfileRow, authUser?: User | null): UserAccount {
  return {
    id: row.id,
    email: row.email ?? authUser?.email ?? '',
    playerName: row.player_name,
    playerId: row.player_id ?? undefined,
    guildName: row.guild_name ?? undefined,
    allianceName: row.alliance_name ?? undefined,
    server: row.main_server === 'europe' ? 'europe' : 'americas',
    plan: row.plan === 'pro' ? 'pro' : 'free',
    subscriptionStatus: normalizeSubscriptionStatus(row.subscription_status),
    createdAt: row.created_at,
    lastLoginAt: new Date().toISOString(),
  };
}

export async function getProfile(userId: string, authUser?: User | null): Promise<UserAccount | null> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return profileRowToUser(data as ProfileRow, authUser);
}

export async function upsertProfile(input: {
  id: string;
  email: string;
  playerName: string;
  playerId?: string;
  guildName?: string;
  allianceName?: string;
  server: ServerParam;
  plan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
}): Promise<UserAccount> {
  const supabase = ensureSupabaseClient();
  const payload = {
    id: input.id,
    email: input.email,
    player_name: input.playerName,
    player_id: input.playerId ?? null,
    guild_name: input.guildName ?? null,
    alliance_name: input.allianceName ?? null,
    main_server: input.server,
    plan: input.plan ?? 'free',
    subscription_status: input.subscriptionStatus ?? input.plan ?? 'free',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;

  return profileRowToUser(data as ProfileRow);
}

export async function ensureUserSettings(userId: string, server: ServerParam): Promise<UserSettings> {
  const existingSettings = await getUserSettings(userId);

  if (existingSettings) return existingSettings;

  return upsertUserSettings(userId, {
    ...DEFAULT_USER_SETTINGS,
    defaultServer: server,
  });
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('user_settings')
    .select('default_server, market_tax, main_city, update_interval_minutes, currency')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return settingsRowToDomain(data as UserSettingsRow);
}

export async function upsertUserSettings(userId: string, settings: UserSettings): Promise<UserSettings> {
  const supabase = ensureSupabaseClient();
  const normalizedSettings = mergeWithDefaultSettings(settings);
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        default_server: normalizedSettings.defaultServer,
        market_tax: normalizedSettings.marketTax / 100,
        main_city: normalizedSettings.mainCity,
        update_interval_minutes: normalizedSettings.updateInterval,
        currency: normalizedSettings.currency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('default_server, market_tax, main_city, update_interval_minutes, currency')
    .single();

  if (error) throw error;

  return settingsRowToDomain(data as UserSettingsRow);
}

export async function fetchTraderOperations(): Promise<TraderOperation[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('trader_operations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as TraderOperationRow[]).map(traderOperationRowToDomain);
}

export async function createTraderOperation(operation: NewTraderOperation): Promise<TraderOperation> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('trader_operations')
    .insert(traderOperationToRow(operation))
    .select('*')
    .single();

  if (error) throw error;

  return traderOperationRowToDomain(data as TraderOperationRow);
}

export async function updateTraderOperation(operationId: string, operation: NewTraderOperation): Promise<TraderOperation> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('trader_operations')
    .update({
      ...traderOperationToRow(operation),
      updated_at: new Date().toISOString(),
    })
    .eq('id', operationId)
    .select('*')
    .single();

  if (error) throw error;

  return traderOperationRowToDomain(data as TraderOperationRow);
}

export async function deleteTraderOperation(operationId: string) {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('trader_operations').delete().eq('id', operationId);

  if (error) throw error;
}

export async function clearTraderOperations() {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('trader_operations').delete().not('id', 'is', null);

  if (error) throw error;
}

export async function fetchFavoritesFromSupabase(): Promise<FavoriteItem[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FavoriteRow[]).map(favoriteRowToDomain);
}

export async function updateFavoriteAlert(favoriteId: string, alertEnabled: boolean) {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase
    .from('favorites')
    .update({ alert_enabled: alertEnabled })
    .eq('id', favoriteId);

  if (error) throw error;
}

export async function deleteFavoriteFromSupabase(favoriteId: string) {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);

  if (error) throw error;
}

export async function fetchWeaponListingsFromSupabase(): Promise<Weapon4Listing[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('weapon_listings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as WeaponListingRow[]).map(weaponListingRowToDomain);
}

export async function createWeaponListingInSupabase(listing: Weapon4Listing): Promise<Weapon4Listing> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('weapon_listings')
    .insert(weaponListingToRow(listing))
    .select('*')
    .single();

  if (error) throw error;

  return weaponListingRowToDomain(data as WeaponListingRow);
}

export async function updateWeaponListingInSupabase(listing: Weapon4Listing): Promise<Weapon4Listing> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('weapon_listings')
    .update({
      ...weaponListingToRow(listing),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listing.id)
    .select('*')
    .single();

  if (error) throw error;

  return weaponListingRowToDomain(data as WeaponListingRow);
}

export async function deleteWeaponListingFromSupabase(listingId: string) {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('weapon_listings').delete().eq('id', listingId);

  if (error) throw error;
}

export async function fetchChatMessages(channel: ChatChannel): Promise<ChatMessage[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('channel', channel)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;

  return ((data ?? []) as ChatMessageRow[]).reverse().map(chatMessageRowToDomain);
}

export async function sendChatMessage(input: {
  playerName: string;
  channel: ChatChannel;
  content: string;
}): Promise<ChatMessage> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      player_name: input.playerName,
      channel: input.channel,
      content: input.content,
    })
    .select('*')
    .single();

  if (error) throw error;

  return chatMessageRowToDomain(data as ChatMessageRow);
}

export async function reportChatMessage(messageId: string) {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase
    .from('chat_messages')
    .update({ status: 'reported' })
    .eq('id', messageId);

  if (error) throw error;
}

export function subscribeToChatMessages(channel: ChatChannel, onMessage: (message: ChatMessage) => void) {
  const supabase = getBrowserSupabase();

  if (!supabase) return null;

  return supabase
    .channel(`chat:${channel}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel=eq.${channel}`,
      },
      (payload: RealtimePostgresInsertPayload<ChatMessageRow>) => {
        onMessage(chatMessageRowToDomain(payload.new as ChatMessageRow));
      },
    )
    .subscribe();
}

function settingsRowToDomain(row: UserSettingsRow): UserSettings {
  const storedMarketTax = Number(row.market_tax);

  return mergeWithDefaultSettings({
    defaultServer: row.default_server,
    marketTax: storedMarketTax <= 1 ? storedMarketTax * 100 : storedMarketTax,
    mainCity: row.main_city ?? DEFAULT_USER_SETTINGS.mainCity,
    updateInterval: row.update_interval_minutes ?? DEFAULT_USER_SETTINGS.updateInterval,
    darkTheme: true,
    currency: row.currency ?? 'prata',
  });
}

function traderOperationRowToDomain(row: TraderOperationRow): TraderOperation {
  return {
    id: row.id,
    type: row.type,
    itemName: row.item_name,
    itemId: row.item_id ?? undefined,
    server: row.server ?? undefined,
    city: row.city ?? undefined,
    unitBuyPrice: toOptionalNumber(row.unit_buy_price),
    unitSellPrice: toOptionalNumber(row.unit_sell_price),
    unitPrice: toOptionalNumber(row.unit_price),
    quantity: Number(row.quantity),
    taxRate: toOptionalNumber(row.tax_rate),
    relatedPositionKey: row.related_position_key ?? row.related_buy_id ?? undefined,
    isQuickSale: Boolean(row.is_quick_sale),
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
  };
}

function traderOperationToRow(operation: NewTraderOperation) {
  return {
    type: operation.type,
    item_name: operation.itemName,
    item_id: operation.itemId ?? null,
    server: operation.server ?? null,
    city: operation.city ?? null,
    unit_buy_price: operation.unitBuyPrice ?? null,
    unit_sell_price: operation.unitSellPrice ?? null,
    unit_price: operation.unitPrice ?? null,
    quantity: operation.quantity,
    tax_rate: operation.taxRate ?? null,
    related_buy_id: isUuid(operation.relatedPositionKey) ? operation.relatedPositionKey : null,
    related_position_key: operation.relatedPositionKey ?? null,
    is_quick_sale: Boolean(operation.isQuickSale),
    notes: operation.notes ?? null,
    created_at: operation.createdAt ?? new Date().toISOString(),
  };
}

function favoriteRowToDomain(row: FavoriteRow): FavoriteItem {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    targetPrice: Number(row.target_price ?? 0),
    buyCity: row.city ?? 'Bridgewatch',
    sellCity: row.city ?? 'Caerleon',
    alertStatus: Boolean(row.alert_enabled),
    expectedProfit: 0,
    updatedAt: row.created_at,
  };
}

function weaponListingRowToDomain(row: WeaponListingRow): Weapon4Listing {
  const useCases = row.suggested_use
    ? row.suggested_use.split(',').map((item) => item.trim()).filter(Boolean) as WeaponUseCase[]
    : [];
  const type: Weapon4ListingType = row.is_awakened ? 'awakened' : 'standard-4';

  return {
    id: row.id,
    weaponName: row.weapon_name,
    itemId: row.item_id ?? undefined,
    tier: row.tier as Tier,
    enchantment: 4,
    quality: row.quality ?? 'Excellent',
    server: row.server,
    city: row.city ?? 'Caerleon',
    askingPrice: Number(row.asking_price),
    sellerName: row.seller_player_name,
    sellerUserId: row.user_id,
    sellerPlayerName: row.seller_player_name,
    sellerPlayerId: row.seller_player_id ?? undefined,
    sellerServer: row.server === 'Europe' ? 'europe' : 'americas',
    sellerContact: row.seller_contact ?? undefined,
    safetyAcceptedAt: row.safety_accepted_at ?? row.created_at,
    status: row.status,
    description: row.description ?? undefined,
    useCases,
    screenshots: [],
    type,
    isAwakened: Boolean(row.is_awakened),
    traits: Array.isArray(row.traits) ? row.traits as Weapon4Listing['traits'] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function weaponListingToRow(listing: Weapon4Listing) {
  return {
    seller_player_name: listing.sellerPlayerName,
    seller_player_id: listing.sellerPlayerId ?? null,
    weapon_name: listing.weaponName,
    item_id: listing.itemId ?? null,
    tier: listing.tier,
    enchantment: 4,
    quality: listing.quality,
    server: listing.server,
    city: listing.city,
    asking_price: listing.askingPrice,
    status: listing.status,
    is_awakened: listing.isAwakened,
    traits: listing.traits,
    suggested_use: listing.useCases.join(', '),
    description: listing.description ?? listing.notes ?? null,
    seller_contact: listing.sellerContact ?? null,
    safety_accepted_at: listing.safetyAcceptedAt,
  };
}

function chatMessageRowToDomain(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    playerName: row.player_name,
    channel: row.channel,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalizeSubscriptionStatus(value: string): SubscriptionStatus {
  if (value === 'active' || value === 'past_due' || value === 'canceled') return value;

  return 'free';
}

function toOptionalNumber(value: number | null): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value) : undefined;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function serverRegionToParam(server: ServerRegion): ServerParam {
  return server === 'Europe' ? 'europe' : 'americas';
}

export function serverParamToDbRegion(server: ServerParam): ServerRegion {
  return serverParamToRegion(server);
}
