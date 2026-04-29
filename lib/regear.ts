import { ALBION_CITIES } from '@/data/constants';
import type { AlbionCity, CityPrice, UpdateStatus } from '@/types/albion';
import type { RegearConfidence } from '@/types/regear';

export const REGEAR_MARKET_CITIES = ALBION_CITIES.filter(
  (city): city is Exclude<AlbionCity, 'Black Market'> => city !== 'Black Market',
);

export function findLowestSellPrice(prices: CityPrice[]): CityPrice | null {
  return prices
    .filter((price) => price.city !== 'Black Market' && price.sellPriceMin > 0)
    .sort((a, b) => a.sellPriceMin - b.sellPriceMin)[0] ?? null;
}

export function findCitySellPrice(prices: CityPrice[], city: AlbionCity): CityPrice | null {
  return prices.find((price) => price.city === city && price.sellPriceMin > 0) ?? null;
}

export function confidenceFromStatus(status: UpdateStatus | 'missing'): RegearConfidence {
  if (status === 'updated') return 'high';
  if (status === 'medium') return 'medium';
  return 'low';
}

export function confidenceLabel(confidence: RegearConfidence): string {
  const labels: Record<RegearConfidence, string> = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };

  return labels[confidence];
}

export function confidenceVariant(confidence: RegearConfidence): 'success' | 'warning' | 'danger' {
  if (confidence === 'high') return 'success';
  if (confidence === 'medium') return 'warning';
  return 'danger';
}

export function aggregateConfidence(statuses: Array<UpdateStatus | 'missing'>): RegearConfidence {
  if (statuses.length === 0 || statuses.includes('missing') || statuses.includes('outdated')) return 'low';
  if (statuses.includes('medium')) return 'medium';
  return 'high';
}

export function worstStatus(statuses: Array<UpdateStatus | 'missing'>): UpdateStatus | 'missing' {
  if (statuses.includes('missing')) return 'missing';
  if (statuses.includes('outdated')) return 'outdated';
  if (statuses.includes('medium')) return 'medium';
  return 'updated';
}
