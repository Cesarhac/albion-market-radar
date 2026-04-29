import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
  AlbionCity,
  Enchantment,
  Item,
  ServerRegion,
  ProfitBreakdown,
  Quality,
  RiskLevel,
  Tier,
  UpdateStatus,
} from '@/types/albion';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSilver(value: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(Math.round(value))} prata`;
}

export function formatCompactSilver(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)} prata`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return 'indisponível';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(value: string | number | Date): string {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return 'sem atualização';

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.round(hours / 24);
  return `há ${days} d`;
}

export function getUpdateStatus(updatedAt: string | number | Date): UpdateStatus {
  const timestamp = new Date(updatedAt).getTime();

  if (!Number.isFinite(timestamp)) return 'outdated';

  const minutes = Math.max(0, (Date.now() - timestamp) / 60_000);

  if (minutes <= 120) return 'updated';
  if (minutes <= 720) return 'medium';
  return 'outdated';
}

export function calculateNetProfit(buyPrice: number, sellPrice: number, taxRate: number): number {
  const estimatedTax = sellPrice * (taxRate / 100);
  return sellPrice - buyPrice - estimatedTax;
}

export function calculateProfitBreakdown(
  buyPrice: number,
  sellPrice: number,
  taxRate: number,
): ProfitBreakdown {
  const grossProfit = sellPrice - buyPrice;
  const estimatedTax = sellPrice * (taxRate / 100);
  const netProfit = grossProfit - estimatedTax;
  const margin = buyPrice > 0 ? (netProfit / buyPrice) * 100 : 0;

  return {
    grossProfit,
    estimatedTax,
    netProfit,
    margin,
  };
}

export function riskLabel(risk: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    low: 'Baixo risco',
    medium: 'Risco médio',
    high: 'Alto risco',
  };

  return labels[risk];
}

export function updateStatusLabel(status: UpdateStatus): string {
  const labels: Record<UpdateStatus, string> = {
    updated: 'Atualizado',
    medium: 'Médio',
    outdated: 'Desatualizado',
  };

  return labels[status];
}

export function formatCityName(city: AlbionCity): string {
  return city === 'Black Market' ? 'Mercado Negro' : city;
}

export function formatServerName(server: ServerRegion): string {
  if (server === 'Americas') return 'Américas';
  return 'Europa';
}

export function formatQuality(quality: Quality): string {
  const labels: Record<Quality, string> = {
    Normal: 'Normal',
    Good: 'Bom',
    Outstanding: 'Excepcional',
    Excellent: 'Excelente',
    Masterpiece: 'Obra-prima',
  };

  return labels[quality];
}

export function formatEnchantment(enchantment: Enchantment): string {
  return enchantment === 0 ? 'Sem encantamento' : `.${enchantment}`;
}

export function formatTierEnchant(tier: Tier, enchantment: Enchantment): string {
  return `T${tier}.${enchantment}`;
}

export function getDisplayItemName(item: Item, locale: 'pt-BR' | 'en-US' = 'pt-BR'): string {
  return locale === 'pt-BR' ? item.namePtBR : item.nameEn;
}

export function getDisplayItemFullName(item: Item, locale: 'pt-BR' | 'en-US' = 'pt-BR'): string {
  return `${getDisplayItemName(item, locale)} ${formatTierEnchant(item.tier, item.enchantment)} — ${formatQuality(item.quality)}`;
}
