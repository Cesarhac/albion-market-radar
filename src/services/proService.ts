import type { Opportunity } from '@/types/albion';
import type { TraderOperationMetrics } from '@/types/trader';

type CsvColumn<Row> = {
  key: string;
  header: string;
  value: (row: Row) => string | number | boolean | null | undefined;
};

export function todayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function buildCsv<Row>(rows: Row[], columns: Array<CsvColumn<Row>>): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(','),
  );

  return [header, ...body].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportOpportunitiesCsv(opportunities: Opportunity[]) {
  const csv = buildCsv(opportunities, [
    { key: 'itemName', header: 'itemName', value: (row) => row.itemName },
    { key: 'itemId', header: 'itemId', value: (row) => row.itemId },
    { key: 'server', header: 'server', value: (row) => row.server },
    { key: 'type', header: 'type', value: (row) => formatOpportunityType(row.type) },
    { key: 'buyCity', header: 'buyCity', value: (row) => row.buyCity },
    { key: 'sellCity', header: 'sellCity', value: (row) => row.sellCity },
    { key: 'buyPrice', header: 'buyPrice', value: (row) => row.buyPrice },
    { key: 'sellPrice', header: 'sellPrice', value: (row) => row.sellPrice },
    { key: 'blackMarketBuyPrice', header: 'mercado_negro_buy_price', value: (row) => row.blackMarketBuyPrice ?? '' },
    { key: 'grossProfit', header: 'grossProfit', value: (row) => row.grossProfit },
    { key: 'tax', header: 'tax', value: (row) => row.estimatedTax },
    { key: 'taxRateApplied', header: 'taxa_usada', value: (row) => row.taxRateApplied ?? '' },
    { key: 'premiumActive', header: 'premium_ativo', value: (row) => inferPremiumFromTaxRate(row) },
    { key: 'netProfit', header: 'netProfit', value: (row) => row.netProfit },
    { key: 'margin', header: 'margin', value: (row) => row.margin },
    { key: 'score', header: 'score', value: (row) => row.score ?? 0 },
    { key: 'confidence', header: 'confidence', value: (row) => row.confidence ?? 'low' },
    { key: 'risk', header: 'risk', value: (row) => row.risk },
    { key: 'estimatedLiquidity', header: 'liquidez_estimada', value: (row) => row.estimatedLiquidity ?? '' },
    { key: 'quantityAvailable', header: 'quantidade_disponivel', value: (row) => row.quantityAvailableLabel ?? '' },
    { key: 'worthLevel', header: 'vale_a_pena', value: (row) => row.worthLevel ?? '' },
    { key: 'buyUpdatedAt', header: 'buyUpdatedAt', value: (row) => row.buyUpdatedAt ?? '' },
    { key: 'sellUpdatedAt', header: 'sellUpdatedAt', value: (row) => row.sellUpdatedAt ?? '' },
    { key: 'blackMarketUpdatedAt', header: 'idade_dado_bm', value: (row) => row.blackMarketUpdatedAt ?? '' },
  ]);

  downloadCsv(`albion-opportunities-${todayStamp()}.csv`, csv);
}

export function exportTraderWalletCsv(rows: TraderOperationMetrics[]) {
  const csv = buildCsv(rows, [
    {
      key: 'type',
      header: 'type',
      value: (row) => formatTraderOperationType(row),
    },
    { key: 'itemName', header: 'itemName', value: (row) => row.operation.itemName },
    { key: 'itemId', header: 'itemId', value: (row) => row.operation.itemId ?? '' },
    { key: 'server', header: 'server', value: (row) => row.operation.server ?? '' },
    { key: 'city', header: 'city', value: (row) => row.operation.city ?? '' },
    { key: 'unitBuyPrice', header: 'unitBuyPrice', value: (row) => row.operation.unitBuyPrice ?? row.operation.unitPrice ?? '' },
    { key: 'unitSellPrice', header: 'unitSellPrice', value: (row) => row.operation.unitSellPrice ?? '' },
    { key: 'quantity', header: 'quantity', value: (row) => row.operation.quantity },
    { key: 'tax', header: 'tax', value: (row) => row.tax },
    { key: 'netProfit', header: 'netProfit', value: (row) => row.netProfit },
    { key: 'createdAt', header: 'createdAt', value: (row) => row.operation.createdAt },
    { key: 'notes', header: 'notes', value: (row) => row.operation.notes ?? '' },
  ]);

  downloadCsv(`albion-trader-wallet-${todayStamp()}.csv`, csv);
}

function formatOpportunityType(type: Opportunity['type']) {
  if (type === 'black-market') return 'Mercado Negro';
  if (type === 'underpriced') return 'Subpreço';
  return type === 'listed-resale' ? 'Revenda anunciada' : 'Venda rápida';
}

function inferPremiumFromTaxRate(row: Opportunity) {
  if (row.taxRateApplied === undefined) return '';

  return row.taxRateApplied <= 0.065;
}

function formatTraderOperationType(row: TraderOperationMetrics) {
  if (row.operation.type !== 'sell') return 'Compra';

  return row.operation.isQuickSale ? 'Venda rápida' : 'Revenda anunciada';
}

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);

  if (!/[",\n\r]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}
