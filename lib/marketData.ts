import { ALBION_CITIES } from '@/data/constants';
import { findCatalogItemByUniqueName, getItemBaseDisplayName } from '@/data/itemCatalog';
import type {
  AlbionCity,
  AlbionDataPriceResponse,
  CityPrice,
  Item,
  ItemCatalogEntry,
  MarketResponseMeta,
  Quality,
  RiskLevel,
  ServerParam,
  ServerRegion,
  UpdateStatus,
} from '@/types/albion';
import { getUpdateStatus } from '@/lib/utils';

export const ALBION_DATA_HOST_BY_SERVER: Record<ServerParam, string> = {
  americas: 'https://west.albion-online-data.com',
  europe: 'https://europe.albion-online-data.com',
};

export const QUALITY_TO_ALBION_DATA_ID: Record<Quality, number> = {
  Normal: 1,
  Good: 2,
  Outstanding: 3,
  Excellent: 4,
  Masterpiece: 5,
};

export const ALBION_DATA_ID_TO_QUALITY: Record<number, Quality> = {
  1: 'Normal',
  2: 'Good',
  3: 'Outstanding',
  4: 'Excellent',
  5: 'Masterpiece',
};

const ITEM_ID_PATTERN = /^[A-Z0-9_@-]+$/i;

export function normalizeServerParam(value: string | null): ServerRegion | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'americas' || normalized === 'america' || normalized === 'west') return 'Americas';
  if (normalized === 'europe' || normalized === 'europa') return 'Europe';

  return null;
}

export function serverToParam(server: ServerRegion): ServerParam {
  if (server === 'Americas') return 'americas';
  return 'europe';
}

export function serverParamToLabel(server: ServerParam): string {
  if (server === 'americas') return 'Américas';
  return 'Europa';
}

export function serverToDisplayName(server: ServerRegion): string {
  return serverParamToLabel(serverToParam(server));
}

export function getSourceHost(server: ServerRegion): string {
  return ALBION_DATA_HOST_BY_SERVER[serverToParam(server)];
}

export function buildMarketMeta(
  server: ServerRegion,
  qualityIds: number[],
  message?: string,
  source: MarketResponseMeta['source'] = 'live',
): MarketResponseMeta {
  const serverParam = serverToParam(server);

  return {
    server: serverParam,
    serverLabel: serverParamToLabel(serverParam),
    sourceHost: ALBION_DATA_HOST_BY_SERVER[serverParam],
    requestedLocations: [...ALBION_CITIES],
    requestedQualities: qualityIds,
    fetchedAt: new Date().toISOString(),
    source,
    message,
  };
}

export function isValidItemId(value: string): boolean {
  return ITEM_ID_PATTERN.test(value.trim());
}

export function normalizeItemId(value: string): string {
  return value.trim().toUpperCase();
}

export function parseQualityIdsParam(value: string | null): number[] | null {
  if (!value) return [1];

  const parsed = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));

  if (parsed.length === 0 || parsed.some((item) => !ALBION_DATA_ID_TO_QUALITY[item])) {
    return null;
  }

  return Array.from(new Set(parsed));
}

export function qualityIdsFromQuality(quality: Quality | 'all' | undefined, fallback: Quality): number[] {
  if (!quality || quality === 'all') return [QUALITY_TO_ALBION_DATA_ID[fallback]];

  return [QUALITY_TO_ALBION_DATA_ID[quality]];
}

export function qualityFromIds(qualityIds: number[], fallback: Quality): Quality {
  return ALBION_DATA_ID_TO_QUALITY[qualityIds[0]] ?? fallback;
}

export function isAlbionCity(value: string): value is AlbionCity {
  return ALBION_CITIES.includes(value as AlbionCity);
}

export function parseLocationParam(value: string | null): AlbionCity | null {
  if (!value) return null;
  const decoded = value.trim();

  return isAlbionCity(decoded) ? decoded : null;
}

export function isAlbionDataPriceResponse(value: unknown): value is AlbionDataPriceResponse {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AlbionDataPriceResponse>;

  return (
    typeof candidate.item_id === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.quality === 'number' &&
    typeof candidate.sell_price_min === 'number' &&
    typeof candidate.sell_price_min_date === 'string' &&
    typeof candidate.buy_price_max === 'number' &&
    typeof candidate.buy_price_max_date === 'string'
  );
}

export function normalizePriceRows(
  itemId: string,
  qualityIds: number[],
  rows: AlbionDataPriceResponse[],
): CityPrice[] {
  const itemRows = rows.filter(
    (row) => row.item_id.toUpperCase() === itemId.toUpperCase() && qualityIds.includes(row.quality),
  );

  return ALBION_CITIES.map((city) => {
    const cityRows = itemRows.filter((row) => row.city === city);
    const sellRows = cityRows.filter((row) => row.sell_price_min > 0);
    const buyRows = cityRows.filter((row) => row.buy_price_max > 0);
    const bestSellRow = [...sellRows].sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
    const bestBuyRow = [...buyRows].sort((a, b) => b.buy_price_max - a.buy_price_max)[0];
    const sellPriceMin = bestSellRow?.sell_price_min ?? 0;
    const buyPriceMax = bestBuyRow?.buy_price_max ?? 0;
    const sellUpdatedAt = normalizeAlbionDate(bestSellRow?.sell_price_min_date);
    const buyUpdatedAt = normalizeAlbionDate(bestBuyRow?.buy_price_max_date);
    const updatedAt = getLatestValidDate([
      sellUpdatedAt,
      buyUpdatedAt,
      ...cityRows.flatMap((row) => [row.sell_price_min_date, row.buy_price_max_date]),
    ]);
    const positivePrices = [sellPriceMin, buyPriceMax].filter((price) => price > 0);
    const averagePrice =
      positivePrices.length > 0
        ? positivePrices.reduce((total, price) => total + price, 0) / positivePrices.length
        : 0;
    const hasMarketData = sellPriceMin > 0 || buyPriceMax > 0;

    return {
      city,
      sellPriceMin,
      buyPriceMax,
      averagePrice,
      estimatedVolume: 0,
      updatedAt,
      sellUpdatedAt,
      buyUpdatedAt,
      updateStatus: getUpdateStatus(updatedAt),
      hasMarketData,
    };
  });
}

export function buildMarketItem(
  catalogItem: ItemCatalogEntry,
  qualityIds: number[],
  rows: AlbionDataPriceResponse[],
  server?: ServerRegion,
): Item {
  const quality = qualityFromIds(qualityIds, catalogItem.defaultQuality);
  const prices = normalizePriceRows(catalogItem.uniqueName, qualityIds, rows);
  const hasMarketData = prices.some((price) => price.hasMarketData);

  return {
    itemId: catalogItem.itemId,
    uniqueName: catalogItem.uniqueName,
    nameEn: getItemBaseDisplayName(catalogItem, 'en-US'),
    namePtBR: getItemBaseDisplayName(catalogItem, 'pt-BR'),
    familyId: catalogItem.familyId,
    baseNameEn: getItemBaseDisplayName(catalogItem, 'en-US'),
    baseNamePtBR: getItemBaseDisplayName(catalogItem, 'pt-BR'),
    resolvedFromUniqueName: catalogItem.resolvedFromUniqueName,
    aliases: catalogItem.aliases,
    tier: catalogItem.tier,
    enchantment: catalogItem.enchantment,
    quality,
    category: catalogItem.category,
    subcategory: catalogItem.subcategory,
    itemPower: catalogItem.itemPower,
    prices,
    dataSource: 'live',
    hasMarketData,
    server,
    sourceHost: server ? getSourceHost(server) : undefined,
    marketNotice: 'Os preços são baseados nos dados públicos disponíveis mais recentes e podem variar dentro do jogo.',
  };
}

export function fallbackCatalogItem(itemId: string): ItemCatalogEntry | null {
  const normalizedItemId = normalizeItemId(itemId);
  const catalogItem = findCatalogItemByUniqueName(normalizedItemId);

  if (catalogItem) return catalogItem;

  return null;
}

export function riskFromUpdateStatuses(statuses: UpdateStatus[], margin: number): RiskLevel {
  if (statuses.includes('outdated') || margin < 5) return 'high';
  if (statuses.includes('medium') || margin < 15) return 'medium';
  return 'low';
}

export function getWorstStatus(prices: CityPrice[]): UpdateStatus {
  if (prices.some((price) => price.updateStatus === 'outdated')) return 'outdated';
  if (prices.some((price) => price.updateStatus === 'medium')) return 'medium';
  return 'updated';
}

function getLatestValidDate(values: Array<string | undefined>): string {
  const timestamps = values
    .map((value) => {
      if (!value || value.startsWith('0001-01-01')) return Number.NaN;
      return new Date(value).getTime();
    })
    .filter(Number.isFinite);

  if (timestamps.length === 0) return '';

  return new Date(Math.max(...timestamps)).toISOString();
}

function normalizeAlbionDate(value: string | undefined): string {
  if (!value || value.startsWith('0001-01-01')) return '';

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return '';

  return new Date(timestamp).toISOString();
}
