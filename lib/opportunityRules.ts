import type { AlbionCity, OpportunityType } from '@/types/albion';

export const MAX_DEFAULT_MARGIN_PERCENT = 300;
export const HIGH_RESALE_MARGIN_PERCENT = 100;
export const MAX_DEFAULT_PRICE_RATIO = 4;
export const MAX_ABSOLUTE_PRICE_RATIO = 10;
export const SELL_OUTLIER_MEDIAN_MULTIPLIER = 3;
export const SELL_EXTREME_OUTLIER_MEDIAN_MULTIPLIER = 5;
export const BUY_OUTLIER_MEDIAN_MULTIPLIER = 0.25;
export const CHEAP_ITEM_PRICE_THRESHOLD = 20_000;
export const CHEAP_ITEM_ABSURD_PROFIT = 1_000_000;

export type PriceOutlierSeverity = 'none' | 'warning' | 'extreme';

export interface PriceOutlierOptions {
  direction?: 'above' | 'below' | 'both';
  warningMultiplier?: number;
  extremeMultiplier?: number;
  lowerMultiplier?: number;
}

export interface PriceOutlierResult {
  isOutlier: boolean;
  isExtreme: boolean;
  severity: PriceOutlierSeverity;
  multiplier: number | null;
}

export interface OpportunityPriceCandidate {
  type: OpportunityType;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  netProfit: number;
  maxDataAgeHours: number;
  buyCity?: AlbionCity;
  sellCity?: AlbionCity;
}

export interface OpportunityMarketContext {
  referenceSellMedian: number | null;
  validSellPriceCount: number;
  maxAgeHours: number;
}

export interface OpportunityPriceSanityResult {
  isSane: boolean;
  isSuspicious: boolean;
  isRejectedByDefault: boolean;
  suspicionReasons: string[];
  rejectionReasons: string[];
  referenceMedianPrice: number | null;
  priceRatio: number;
  sellPriceOutlier: boolean;
  buyPriceOutlier: boolean;
  sellPriceMedianMultiplier: number | null;
  buyPriceMedianMultiplier: number | null;
  scorePenalty: number;
}

export function calculateMedianPrice(prices: number[]): number | null {
  const validPrices = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (validPrices.length === 0) return null;

  const middle = Math.floor(validPrices.length / 2);

  if (validPrices.length % 2 === 1) return validPrices[middle] ?? null;

  const lower = validPrices[middle - 1] ?? 0;
  const upper = validPrices[middle] ?? 0;

  return (lower + upper) / 2;
}

export function isOutlierPrice(
  price: number,
  median: number | null | undefined,
  options: PriceOutlierOptions = {},
): PriceOutlierResult {
  if (!Number.isFinite(price) || price <= 0 || !median || median <= 0) {
    return {
      isOutlier: false,
      isExtreme: false,
      severity: 'none',
      multiplier: null,
    };
  }

  const direction = options.direction ?? 'above';
  const warningMultiplier = options.warningMultiplier ?? SELL_OUTLIER_MEDIAN_MULTIPLIER;
  const extremeMultiplier = options.extremeMultiplier ?? SELL_EXTREME_OUTLIER_MEDIAN_MULTIPLIER;
  const lowerMultiplier = options.lowerMultiplier ?? BUY_OUTLIER_MEDIAN_MULTIPLIER;
  const multiplier = price / median;

  if ((direction === 'above' || direction === 'both') && multiplier > extremeMultiplier) {
    return {
      isOutlier: true,
      isExtreme: true,
      severity: 'extreme',
      multiplier,
    };
  }

  if ((direction === 'above' || direction === 'both') && multiplier > warningMultiplier) {
    return {
      isOutlier: true,
      isExtreme: false,
      severity: 'warning',
      multiplier,
    };
  }

  if ((direction === 'below' || direction === 'both') && multiplier < lowerMultiplier) {
    return {
      isOutlier: true,
      isExtreme: false,
      severity: 'warning',
      multiplier,
    };
  }

  return {
    isOutlier: false,
    isExtreme: false,
    severity: 'none',
    multiplier,
  };
}

export function isSaneOpportunityPrice(
  opportunity: OpportunityPriceCandidate,
  marketContext: OpportunityMarketContext,
): OpportunityPriceSanityResult {
  const suspicionReasons = new Set<string>();
  const rejectionReasons = new Set<string>();
  const priceRatio = opportunity.buyPrice > 0 ? opportunity.sellPrice / opportunity.buyPrice : Number.POSITIVE_INFINITY;
  const referenceMedianPrice = marketContext.referenceSellMedian;
  let scorePenalty = 0;

  const markSuspicious = (reason: string, penalty: number) => {
    suspicionReasons.add(reason);
    scorePenalty = Math.max(scorePenalty, penalty);
  };

  const rejectByDefault = (reason: string, penalty: number) => {
    markSuspicious(reason, penalty);
    rejectionReasons.add(reason);
  };

  if (opportunity.margin > MAX_DEFAULT_MARGIN_PERCENT) {
    rejectByDefault('Margem acima do limite plausível', 75);
  } else if (opportunity.type === 'listed-resale' && opportunity.margin > HIGH_RESALE_MARGIN_PERCENT) {
    markSuspicious('Revenda anunciada com margem acima de 100%', 35);
  }

  if (opportunity.buyPrice < CHEAP_ITEM_PRICE_THRESHOLD && opportunity.netProfit >= CHEAP_ITEM_ABSURD_PROFIT) {
    rejectByDefault('Lucro unitário absurdo para item barato', 85);
  }

  if (priceRatio > MAX_ABSOLUTE_PRICE_RATIO) {
    rejectByDefault('Diferença extrema entre compra e venda', 85);
  } else if (priceRatio > MAX_DEFAULT_PRICE_RATIO) {
    markSuspicious('Razão venda/compra acima do limite plausível', 45);
  }

  if (opportunity.maxDataAgeHours > marketContext.maxAgeHours) {
    rejectByDefault('Dados acima do limite de idade configurado', 70);
  }

  if (opportunity.type === 'listed-resale' && marketContext.validSellPriceCount < 3) {
    markSuspicious('Dados insuficientes para validar revenda anunciada', 30);
  }

  const sellOutlier = isOutlierPrice(opportunity.sellPrice, referenceMedianPrice, {
    direction: 'above',
    warningMultiplier: SELL_OUTLIER_MEDIAN_MULTIPLIER,
    extremeMultiplier: SELL_EXTREME_OUTLIER_MEDIAN_MULTIPLIER,
  });

  if (sellOutlier.isExtreme) {
    rejectByDefault('Preço de venda muito acima da mediana', 85);
  } else if (sellOutlier.isOutlier) {
    markSuspicious('Preço de venda muito acima da mediana', 55);
  }

  const buyOutlier = isOutlierPrice(opportunity.buyPrice, referenceMedianPrice, {
    direction: 'below',
    lowerMultiplier: BUY_OUTLIER_MEDIAN_MULTIPLIER,
  });

  if (buyOutlier.isOutlier) {
    markSuspicious('Preço de compra muito abaixo da mediana', 40);
  }

  const isSuspicious = suspicionReasons.size > 0;
  const isRejectedByDefault = rejectionReasons.size > 0;

  return {
    isSane: !isSuspicious,
    isSuspicious,
    isRejectedByDefault,
    suspicionReasons: [...suspicionReasons],
    rejectionReasons: [...rejectionReasons],
    referenceMedianPrice,
    priceRatio,
    sellPriceOutlier: sellOutlier.isOutlier,
    buyPriceOutlier: buyOutlier.isOutlier,
    sellPriceMedianMultiplier: sellOutlier.multiplier,
    buyPriceMedianMultiplier: buyOutlier.multiplier,
    scorePenalty: Math.min(95, scorePenalty),
  };
}
