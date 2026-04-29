import { NextResponse } from 'next/server';
import { MARKET_SERVER_REGIONS } from '@/data/constants';
import { findCatalogItemByUniqueName } from '@/data/itemCatalog';
import type { MarketHistoryResponse } from '@/types/albion';
import {
  buildMarketMeta,
  isValidItemId,
  normalizeItemId,
  normalizeServerParam,
  parseLocationParam,
  parseQualityIdsParam,
} from '@/lib/marketData';
import { fetchAlbionDataHistory } from '@/app/api/market/_utils';

export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawItemId = searchParams.get('itemId');
  const server = normalizeServerParam(searchParams.get('server'));
  const location = parseLocationParam(searchParams.get('location'));
  const qualityIds = parseQualityIdsParam(searchParams.get('quality') ?? searchParams.get('qualities'));
  const timeScale = parseTimeScale(searchParams.get('timeScale'));

  if (!rawItemId || !isValidItemId(rawItemId)) {
    return NextResponse.json({ error: 'Item ID inválido.' }, { status: 400 });
  }

  if (!server || !MARKET_SERVER_REGIONS.includes(server)) {
    return NextResponse.json(
      { error: 'Servidor inválido. Use server=americas ou server=europe.' },
      { status: 400 },
    );
  }

  if (!location) {
    return NextResponse.json({ error: 'Cidade inválida.' }, { status: 400 });
  }

  if (!qualityIds) {
    return NextResponse.json({ error: 'Qualidade inválida. Use valores de 1 a 5.' }, { status: 400 });
  }

  if (!timeScale) {
    return NextResponse.json({ error: 'Escala de tempo inválida.' }, { status: 400 });
  }

  const itemId = normalizeItemId(rawItemId);
  const catalogItem = findCatalogItemByUniqueName(itemId);

  if (!catalogItem) {
    return NextResponse.json({ error: 'Item não encontrado no catálogo de itens.' }, { status: 404 });
  }

  try {
    const history = await fetchAlbionDataHistory(
      catalogItem.uniqueName,
      server,
      location,
      qualityIds[0],
      timeScale,
    );
    const firstSeries = history[0]?.data ?? [];
    const response: MarketHistoryResponse = {
      ...buildMarketMeta(server, [qualityIds[0]], 'Histórico de ordens de venda do Albion Online Data Project.'),
      requestedLocations: [location],
      itemId: catalogItem.uniqueName,
      location,
      quality: qualityIds[0],
      timeScale,
      data: firstSeries,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível consultar o histórico de mercado agora.' },
      { status: 502 },
    );
  }
}

function parseTimeScale(value: string | null): number | null {
  const numeric = Number(value ?? 24);

  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 24 * 30) return null;

  return numeric;
}
