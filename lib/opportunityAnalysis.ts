import type {
  OpportunityConfidence,
  OpportunityScoreLabel,
  OpportunitySortBy,
  OpportunityType,
  RiskLevel,
} from '@/types/albion';

export const DEFAULT_MIN_OPPORTUNITY_PROFIT = 1000;
export const DEFAULT_MIN_OPPORTUNITY_MARGIN = 5;
export const DEFAULT_MAX_DATA_AGE_HOURS = 24;
export const MAX_SUGGESTED_QUANTITY = 10;

export const OPPORTUNITY_SORT_OPTIONS: Array<{ value: OpportunitySortBy; label: string }> = [
  { value: 'score', label: 'Melhor score' },
  { value: 'profit', label: 'Maior lucro líquido' },
  { value: 'margin', label: 'Maior margem' },
  { value: 'recent', label: 'Mais recente' },
  { value: 'investment', label: 'Menor investimento' },
];

export function opportunityTypeLabel(type: OpportunityType | undefined): string {
  if (type === 'listed-resale') return 'Revenda anunciada';
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

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
