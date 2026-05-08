import type { UserSettings } from '@/types/settings';
import type {
  NewTraderOperation,
  TraderOperation,
  TraderOperationMetrics,
  TraderPosition,
  TraderSummary,
  TraderWallet,
} from '@/types/trader';
import { normalizePlayerName } from '@/lib/authStorage';
import { getSellOrderTotalFeeRate, getTransactionTaxRate } from '@/src/lib/albionTaxes';

const STORAGE_KEY = 'albion-market-radar:trader-wallet';
const EMPTY_WALLET: TraderWallet = {
  operations: [],
  updatedAt: '',
};

type RunningPosition = TraderPosition & {
  totalCost: number;
};

export function getTraderWalletStorageKey(playerName?: string): string {
  const normalizedPlayerName = normalizePlayerName(playerName ?? '');

  return normalizedPlayerName ? `${STORAGE_KEY}:${normalizedPlayerName}` : STORAGE_KEY;
}

export function getTraderWallet(playerName?: string): TraderWallet {
  if (typeof window === 'undefined') return EMPTY_WALLET;

  try {
    const rawValue = window.localStorage.getItem(getTraderWalletStorageKey(playerName));

    if (!rawValue) return EMPTY_WALLET;

    const parsed = JSON.parse(rawValue) as Partial<TraderWallet>;

    return normalizeWallet(parsed);
  } catch {
    return EMPTY_WALLET;
  }
}

export function saveTraderWallet(wallet: TraderWallet, playerName?: string): TraderWallet {
  const normalizedWallet = normalizeWallet({
    ...wallet,
    updatedAt: new Date().toISOString(),
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getTraderWalletStorageKey(playerName), JSON.stringify(normalizedWallet));
  }

  return normalizedWallet;
}

export function addPurchase(wallet: TraderWallet, operation: NewTraderOperation, playerName?: string): TraderWallet {
  return addOperation(wallet, {
    ...operation,
    type: 'buy',
  }, playerName);
}

export function addSale(wallet: TraderWallet, operation: NewTraderOperation, playerName?: string): TraderWallet {
  return addOperation(wallet, {
    ...operation,
    type: 'sell',
  }, playerName);
}

export function updateOperation(
  wallet: TraderWallet,
  operationId: string,
  operation: NewTraderOperation,
  playerName?: string,
): TraderWallet {
  const updatedOperation = normalizeOperation({
    ...operation,
    id: operationId,
    createdAt: operation.createdAt ?? new Date().toISOString(),
  });

  return saveTraderWallet({
    operations: wallet.operations.map((currentOperation) =>
      currentOperation.id === operationId ? updatedOperation : currentOperation,
    ),
    updatedAt: wallet.updatedAt,
  }, playerName);
}

export function deleteOperation(wallet: TraderWallet, operationId: string, playerName?: string): TraderWallet {
  return saveTraderWallet({
    operations: wallet.operations.filter((operation) => operation.id !== operationId),
    updatedAt: wallet.updatedAt,
  }, playerName);
}

export function clearWallet(playerName?: string): TraderWallet {
  return saveTraderWallet(EMPTY_WALLET, playerName);
}

export function calculateTraderSummary(
  operations: TraderOperation[],
  settings: Pick<UserSettings, 'hasAlbionPremium'>,
): TraderSummary {
  const positions = new Map<string, RunningPosition>();
  const metrics: TraderOperationMetrics[] = [];
  const breakEvenFeeRate = getSellOrderTotalFeeRate(settings.hasAlbionPremium);
  let netProfit = 0;
  let totalRevenue = 0;
  let totalTaxes = 0;
  let completedSales = 0;
  let soldCost = 0;

  for (const operation of sortOperationsAscending(operations)) {
    if (operation.type === 'buy') {
      const unitPrice = positiveNumber(operation.unitPrice);
      const quantity = positiveNumber(operation.quantity);
      const total = unitPrice * quantity;
      const key = getTraderPositionKey(operation);
      const currentPosition = positions.get(key);

      if (currentPosition) {
        currentPosition.quantity += quantity;
        currentPosition.totalCost += total;
        currentPosition.averageBuyPrice =
          currentPosition.quantity > 0 ? currentPosition.totalCost / currentPosition.quantity : 0;
        currentPosition.totalInvested = currentPosition.totalCost;
        currentPosition.breakEvenPrice = calculateBreakEvenPrice(
          currentPosition.averageBuyPrice,
          breakEvenFeeRate,
        );
        currentPosition.lastCity = operation.city ?? currentPosition.lastCity;
        currentPosition.lastUpdatedAt = operation.createdAt;
        currentPosition.operationsCount += 1;
      } else {
        positions.set(key, {
          key,
          itemName: operation.itemName,
          itemId: operation.itemId,
          server: operation.server,
          quantity,
          averageBuyPrice: unitPrice,
          totalInvested: total,
          totalCost: total,
          breakEvenPrice: calculateBreakEvenPrice(unitPrice, breakEvenFeeRate),
          lastCity: operation.city,
          lastUpdatedAt: operation.createdAt,
          operationsCount: 1,
        });
      }

      metrics.push({
        operation,
        total,
        revenue: 0,
        tax: 0,
        costBasis: total,
        netProfit: 0,
        roi: 0,
      });

      continue;
    }

    const quantity = positiveNumber(operation.quantity);
    const unitSellPrice = positiveNumber(operation.unitSellPrice);
    const revenue = unitSellPrice * quantity;
    const feeRate = operation.isQuickSale
      ? getTransactionTaxRate(settings.hasAlbionPremium)
      : getSellOrderTotalFeeRate(settings.hasAlbionPremium);
    const tax = revenue * feeRate;
    const key = operation.relatedPositionKey ?? getTraderPositionKey(operation);
    const currentPosition = positions.get(key);
    const unitCost =
      operation.isQuickSale || !currentPosition
        ? positiveNumber(operation.unitBuyPrice)
        : currentPosition.averageBuyPrice;
    const costBasis = unitCost * quantity;
    const saleNetProfit = revenue - tax - costBasis;
    const roi = costBasis > 0 ? (saleNetProfit / costBasis) * 100 : 0;

    if (!operation.isQuickSale && currentPosition) {
      const quantityToRemove = Math.min(quantity, currentPosition.quantity);
      currentPosition.quantity -= quantityToRemove;
      currentPosition.totalCost = Math.max(0, currentPosition.totalCost - currentPosition.averageBuyPrice * quantityToRemove);
      currentPosition.averageBuyPrice =
        currentPosition.quantity > 0 ? currentPosition.totalCost / currentPosition.quantity : 0;
      currentPosition.totalInvested = currentPosition.totalCost;
      currentPosition.breakEvenPrice = calculateBreakEvenPrice(
        currentPosition.averageBuyPrice,
        breakEvenFeeRate,
      );
      currentPosition.lastUpdatedAt = operation.createdAt;

      if (currentPosition.quantity <= 0) {
        positions.delete(key);
      }
    }

    netProfit += saleNetProfit;
    totalRevenue += revenue;
    totalTaxes += tax;
    soldCost += costBasis;
    completedSales += 1;

    metrics.push({
      operation,
      total: revenue,
      revenue,
      tax,
      costBasis,
      netProfit: saleNetProfit,
      roi,
    });
  }

  const openPositions = Array.from(positions.values())
    .filter((position) => position.quantity > 0)
    .map(({ totalCost: _totalCost, ...position }) => position)
    .sort((a, b) => b.totalInvested - a.totalInvested);
  const totalInvested = openPositions.reduce((total, position) => total + position.totalInvested, 0);

  return {
    netProfit,
    totalInvested,
    totalRevenue,
    totalTaxes,
    completedSales,
    openPositionsCount: openPositions.length,
    roi: soldCost > 0 ? (netProfit / soldCost) * 100 : 0,
    soldCost,
    positions: openPositions,
    recentOperations: metrics.sort(
      (a, b) => new Date(b.operation.createdAt).getTime() - new Date(a.operation.createdAt).getTime(),
    ),
  };
}

export function getTraderPositionKey(operation: Pick<TraderOperation, 'itemId' | 'itemName' | 'server'>): string {
  const itemKey = (operation.itemId || operation.itemName).trim().toLowerCase();

  return `${operation.server ?? 'sem-servidor'}:${itemKey}`;
}

export function calculateBreakEvenPrice(unitCost: number, feeRate: number): number {
  const taxFactor = 1 - feeRate;

  if (unitCost <= 0 || taxFactor <= 0) return 0;

  return unitCost / taxFactor;
}

function addOperation(wallet: TraderWallet, operation: NewTraderOperation, playerName?: string): TraderWallet {
  return saveTraderWallet({
    operations: [
      ...wallet.operations,
      normalizeOperation({
        ...operation,
        id: operation.id ?? createOperationId(),
        createdAt: operation.createdAt ?? new Date().toISOString(),
      }),
    ],
    updatedAt: wallet.updatedAt,
  }, playerName);
}

function normalizeWallet(wallet: Partial<TraderWallet>): TraderWallet {
  return {
    operations: Array.isArray(wallet.operations)
      ? wallet.operations.map(normalizeOperation).filter((operation) => operation.itemName.length > 0)
      : [],
    updatedAt: typeof wallet.updatedAt === 'string' ? wallet.updatedAt : '',
  };
}

function normalizeOperation(operation: Partial<TraderOperation>): TraderOperation {
  const type = operation.type === 'sell' ? 'sell' : 'buy';

  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createOperationId(),
    type,
    itemName: String(operation.itemName ?? '').trim(),
    itemId: normalizeOptionalString(operation.itemId),
    server: operation.server === 'europe' ? 'europe' : operation.server === 'americas' ? 'americas' : undefined,
    city: operation.city,
    unitPrice: positiveNumber(operation.unitPrice),
    unitBuyPrice: positiveNumber(operation.unitBuyPrice),
    unitSellPrice: positiveNumber(operation.unitSellPrice),
    quantity: positiveNumber(operation.quantity),
    taxRate: Number.isFinite(operation.taxRate) ? Number(operation.taxRate) : undefined,
    relatedPositionKey: normalizeOptionalString(operation.relatedPositionKey),
    isQuickSale: Boolean(operation.isQuickSale),
    createdAt: typeof operation.createdAt === 'string' && operation.createdAt ? operation.createdAt : new Date().toISOString(),
    notes: normalizeOptionalString(operation.notes),
  };
}

function sortOperationsAscending(operations: TraderOperation[]) {
  return [...operations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function positiveNumber(value: unknown): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `trader-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
