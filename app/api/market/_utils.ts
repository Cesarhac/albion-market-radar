import { ALBION_CITIES } from '@/data/constants';
import type { AlbionCity, AlbionDataHistoryResponse, AlbionDataPriceResponse, ServerRegion } from '@/types/albion';
import {
  ALBION_DATA_HOST_BY_SERVER,
  isAlbionDataPriceResponse,
  serverToParam,
} from '@/lib/marketData';

export class AlbionDataApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message);
    this.name = 'AlbionDataApiError';
  }
}

export async function fetchAlbionDataPrices(
  itemIds: string[],
  server: ServerRegion,
  qualityIds: number[],
  locations: AlbionCity[] = ALBION_CITIES,
): Promise<AlbionDataPriceResponse[]> {
  const url = buildAlbionDataPricesUrl(itemIds, server, qualityIds, locations);

  const payload = await fetchAlbionJson(url);

  if (!Array.isArray(payload)) {
    throw new Error('Resposta inesperada do Albion Online Data Project.');
  }

  return payload.filter(isAlbionDataPriceResponse);
}

export function buildAlbionDataPricesUrl(
  itemIds: string[],
  server: ServerRegion,
  qualityIds: number[],
  locations: AlbionCity[] = ALBION_CITIES,
): URL {
  const url = buildAlbionDataUrl('/api/v2/stats/prices', itemIds, server);

  url.searchParams.set('locations', locations.join(','));
  url.searchParams.set('qualities', qualityIds.join(','));

  return url;
}

export async function fetchAlbionDataHistory(
  itemId: string,
  server: ServerRegion,
  location: AlbionCity,
  quality: number,
  timeScale: number,
): Promise<AlbionDataHistoryResponse[]> {
  const url = buildAlbionDataUrl('/api/v2/stats/history', [itemId], server);

  url.searchParams.set('locations', location);
  url.searchParams.set('qualities', String(quality));
  url.searchParams.set('time-scale', String(timeScale));

  const payload = await fetchAlbionJson(url);

  if (!Array.isArray(payload)) {
    throw new Error('Resposta inesperada do Albion Online Data Project.');
  }

  return payload.filter(isAlbionDataHistoryResponse);
}

function buildAlbionDataUrl(basePath: string, itemIds: string[], server: ServerRegion): URL {
  const host = ALBION_DATA_HOST_BY_SERVER[serverToParam(server)];
  const itemPath = itemIds.map((itemId) => encodeURIComponent(itemId)).join(',');

  return new URL(`${basePath}/${itemPath}.json`, host);
}

async function fetchAlbionJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    throw new AlbionDataApiError(
      `Albion Online Data Project respondeu com status ${response.status}`,
      response.status,
      url.toString(),
    );
  }

  return response.json();
}

function isAlbionDataHistoryResponse(value: unknown): value is AlbionDataHistoryResponse {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AlbionDataHistoryResponse>;

  return (
    typeof candidate.item_id === 'string' &&
    typeof candidate.location === 'string' &&
    typeof candidate.quality === 'number' &&
    Array.isArray(candidate.data)
  );
}
