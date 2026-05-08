import type {
  ItemCategory,
  OpportunityConfidence,
  OpportunityFilters,
  OpportunityScoreLabel,
  OpportunitySortBy,
  OpportunityType,
  OpportunityWorthLevel,
  RiskLevel,
} from '@/types/albion';

export const DEFAULT_MIN_OPPORTUNITY_PROFIT = 1000;
export const DEFAULT_MIN_OPPORTUNITY_MARGIN = 5;
export const PRO_DEFAULT_MIN_OPPORTUNITY_PROFIT = 3000;
export const PRO_DEFAULT_MIN_OPPORTUNITY_MARGIN = 5;
export const DEFAULT_MIN_ESTIMATED_PROFIT = 10_000;
export const PRO_DEFAULT_MIN_ESTIMATED_PROFIT = 25_000;
export const RESOURCE_MIN_ESTIMATED_PROFIT = 50_000;
export const MICRO_FLIP_UNIT_PROFIT = 1000;
export const MICRO_FLIP_TOTAL_PROFIT = 10_000;
export const MIN_ROUTE_EFFORT_PROFIT = 5000;
export const CHEAP_ITEM_PRICE_THRESHOLD_FOR_EFFORT = 20_000;
export const DEFAULT_MAX_DATA_AGE_HOURS = 48;
export const PRO_DEFAULT_MAX_DATA_AGE_HOURS = 72;
export const MAX_SUGGESTED_QUANTITY = 100;

export const OPPORTUNITY_SORT_OPTIONS: Array<{ value: OpportunitySortBy; label: string }> = [
  { value: 'score', label: 'Melhor score' },
  { value: 'profit', label: 'Maior lucro líquido' },
  { value: 'margin', label: 'Maior margem' },
  { value: 'recent', label: 'Mais recente' },
  { value: 'investment', label: 'Menor investimento' },
];

export function opportunityTypeLabel(type: OpportunityType | undefined): string {
  if (type === 'black-market') return 'Mercado Negro';
  if (type === 'listed-resale') return 'Revenda anunciada';
  if (type === 'underpriced') return 'Subpreço';
  return 'Venda rápida';
}

export function confidenceLabel(confidence: OpportunityConfidence | undefined): string {
  if (confidence === 'high') return 'Confiança alta';
  if (confidence === 'medium') return 'Confiança média';
  return 'Confiança baixa';
}

export function riskRank(risk: RiskLevel): number {
  if (risk === 'low') return 1;
  if (risk === 'medium') return 2;
  return 3;
}

export function scoreLabel(score: number): OpportunityScoreLabel {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'medium';
  return 'weak';
}

export function scoreLabelText(label: OpportunityScoreLabel | undefined): string {
  if (label === 'excellent') return 'Excelente';
  if (label === 'good') return 'Boa';
  if (label === 'medium') return 'Média';
  return 'Fraca';
}

export function worthLevelLabel(level: OpportunityWorthLevel | undefined): string {
  if (level === 'excelente') return 'Excelente';
  if (level === 'boa') return 'Útil';
  if (level === 'micro') return 'Micro';
  if (level === 'suspeita') return 'Suspeita';
  return 'Fraca';
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isLowValueResourceCategory(category?: ItemCategory): boolean {
  return category === 'Recursos' || category === 'Materiais refinados';
}

export function calculateSuggestedQuantity({
  budget,
  buyPrice,
  category,
}: {
  budget?: number;
  buyPrice: number;
  category?: ItemCategory;
}): number {
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) return 0;

  if (budget && budget > 0) {
    return Math.max(0, Math.min(MAX_SUGGESTED_QUANTITY, Math.floor(budget / buyPrice)));
  }

  if (isLowValueResourceCategory(category)) return 100;
  if (category === 'Poções' || category === 'Comidas') return 20;

  return 1;
}

export function evaluateOpportunityQuality({
  netProfitPerUnit,
  estimatedNetProfit,
  margin,
  buyPrice,
  buyCity,
  sellCity,
  category,
  confidence,
  isSuspicious,
}: {
  netProfitPerUnit: number;
  estimatedNetProfit: number;
  margin: number;
  buyPrice: number;
  buyCity?: string;
  sellCity?: string;
  category?: ItemCategory;
  confidence?: OpportunityConfidence;
  isSuspicious?: boolean;
}): {
  isMicroFlip: boolean;
  microFlipReasons: string[];
  worthLevel: OpportunityWorthLevel;
  worthReasons: string[];
} {
  const microFlipReasons: string[] = [];
  const worthReasons: string[] = [];
  const isLowValueResource = isLowValueResourceCategory(category);
  const isCrossCity = Boolean(buyCity && sellCity && buyCity !== sellCity);

  if (netProfitPerUnit < MICRO_FLIP_UNIT_PROFIT) {
    microFlipReasons.push('Lucro por unidade muito baixo');
  }

  if (estimatedNetProfit < MICRO_FLIP_TOTAL_PROFIT) {
    microFlipReasons.push('Lucro total estimado não compensa o transporte');
  }

  if (buyPrice < CHEAP_ITEM_PRICE_THRESHOLD_FOR_EFFORT && netProfitPerUnit < MIN_ROUTE_EFFORT_PROFIT) {
    microFlipReasons.push('Item barato com margem alta, mas ganho absoluto irrelevante');
  }

  if (isCrossCity && netProfitPerUnit < MIN_ROUTE_EFFORT_PROFIT) {
    microFlipReasons.push('Lucro por unidade baixo para uma rota entre cidades');
  }

  if (isLowValueResource && estimatedNetProfit < RESOURCE_MIN_ESTIMATED_PROFIT) {
    microFlipReasons.push('Recurso/refinado precisa de lucro total maior para compensar volume e transporte');
  }

  const isMicroFlip = microFlipReasons.length > 0;
  const hasMediumOrHighConfidence = confidence === 'medium' || confidence === 'high';

  if (isSuspicious) {
    worthReasons.push('Preço suspeito ou dado inconsistente');
    return {
      isMicroFlip,
      microFlipReasons,
      worthLevel: 'suspeita',
      worthReasons,
    };
  }

  if (isMicroFlip) {
    worthReasons.push('Margem positiva, mas ganho absoluto pequeno');
    return {
      isMicroFlip,
      microFlipReasons,
      worthLevel: 'micro',
      worthReasons,
    };
  }

  if (
    (netProfitPerUnit >= 20_000 || estimatedNetProfit >= 100_000) &&
    margin >= 10 &&
    hasMediumOrHighConfidence
  ) {
    worthReasons.push('Lucro relevante, margem boa e dados com confiança suficiente');
    return {
      isMicroFlip,
      microFlipReasons,
      worthLevel: 'excelente',
      worthReasons,
    };
  }

  if (
    (netProfitPerUnit >= 5000 || estimatedNetProfit >= 25_000) &&
    margin >= 5 &&
    hasMediumOrHighConfidence
  ) {
    worthReasons.push('Lucro e margem suficientes para entrar no radar principal');
    return {
      isMicroFlip,
      microFlipReasons,
      worthLevel: 'boa',
      worthReasons,
    };
  }

  worthReasons.push('Lucro positivo, mas abaixo dos limites úteis do radar');

  return {
    isMicroFlip,
    microFlipReasons,
    worthLevel: 'fraca',
    worthReasons,
  };
}

export function shouldShowOpportunityByQuality(
  opportunity: {
    netProfitPerUnit?: number;
    netProfit: number;
    estimatedNetProfit?: number;
    isMicroFlip?: boolean;
    worthLevel?: OpportunityWorthLevel;
    isSuspicious?: boolean;
  },
  filters: OpportunityFilters = {},
): boolean {
  const netProfitPerUnit = opportunity.netProfitPerUnit ?? opportunity.netProfit;
  const estimatedNetProfit = opportunity.estimatedNetProfit ?? netProfitPerUnit;
  const minProfit = filters.minProfit ?? DEFAULT_MIN_OPPORTUNITY_PROFIT;
  const minEstimatedProfit = filters.minEstimatedProfit ?? DEFAULT_MIN_ESTIMATED_PROFIT;

  if (netProfitPerUnit < minProfit) return false;
  if (filters.budget && estimatedNetProfit < minEstimatedProfit) return false;
  if (opportunity.isSuspicious && !filters.includeSuspicious) return false;
  if (opportunity.isMicroFlip && !filters.includeMicroFlips) return false;

  if (opportunity.worthLevel === 'suspeita') return Boolean(filters.includeSuspicious);
  if (opportunity.worthLevel === 'micro') return Boolean(filters.includeMicroFlips);

  return opportunity.worthLevel === 'boa' || opportunity.worthLevel === 'excelente';
}
