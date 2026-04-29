import { NextResponse } from 'next/server';
import { MARKET_SERVER_REGIONS } from '@/data/constants';
import { findCatalogItemByUniqueName } from '@/data/itemCatalog';
import type { MarketPricesResponse } from '@/types/albion';
import {
  buildMarketItem,
  buildMarketMeta,
  isValidItemId,
  normalizeItemId,
  normalizeServerParam,
  parseQualityIdsParam,
} from '@/lib/marketData';
import { fetchAlbionDataPrices } from '@/app/api/market/_utils';

export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawItemId = searchParams.get('itemId');
  const server = normalizeServerParam(searchParams.get('server'));
  const qualityIds = parseQualityIdsParam(searchParams.get('qualities'));

  if (!rawItemId || !isValidItemId(rawItemId)) {
    return NextResponse.json({ error: 'Item ID inválido.' }, { status: 400 });
  }

  if (!server || !MARKET_SERVER_REGIONS.includes(server)) {
    return NextResponse.json(
      { error: 'Servidor inválido. Use server=americas ou server=europe.' },
      { status: 400 },
    );
  }

  if (!qualityIds) {
    return NextResponse.json({ error: 'Qualidade inválida. Use valores de 1 a 5.' }, { status: 400 });
  }

  const itemId = normalizeItemId(rawItemId);
  const catalogItem = findCatalogItemByUniqueName(itemId);

  if (!catalogItem) {
    return NextResponse.json({ error: 'Item não encontrado no catálogo de itens.' }, { status: 404 });
  }

  try {
    const rows = await fetchAlbionDataPrices([catalogItem.uniqueName], server, qualityIds);
    const item = buildMarketItem(catalogItem, qualityIds, rows, server);
    const message = item.hasMarketData
      ? 'Preços reais normalizados com base no Albion Online Data Project.'
      : 'Não encontramos dados recentes para este item neste servidor.';
    const response: MarketPricesResponse = {
      ...buildMarketMeta(server, qualityIds, message),
      itemId: catalogItem.uniqueName,
      item,
      data: item.prices,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível consultar os dados de mercado agora.' },
      { status: 502 },
    );
  }
}
