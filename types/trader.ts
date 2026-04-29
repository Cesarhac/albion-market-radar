import type { AlbionCity, ServerParam } from '@/types/albion';

export type TraderOperationType = 'buy' | 'sell';

export type TraderOperation = {
  id: string;
  type: TraderOperationType;
  itemName: string;
  itemId?: string;
  server?: ServerParam;
  city?: AlbionCity;
  unitPrice?: number;
  unitBuyPrice?: number;
  unitSellPrice?: number;
  quantity: number;
  taxRate?: number;
  relatedPositionKey?: string;
  isQuickSale?: boolean;
  createdAt: string;
  notes?: string;
};

export type NewTraderOperation = Omit<TraderOperation, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

export type TraderWallet = {
  operations: TraderOperation[];
  updatedAt: string;
};

export type TraderPosition = {
  key: string;
  itemName: string;
  itemId?: string;
  server?: ServerParam;
  quantity: number;
  averageBuyPrice: number;
  totalInvested: number;
  breakEvenPrice: number;
  lastCity?: AlbionCity;
  lastUpdatedAt: string;
  operationsCount: number;
};

export type TraderOperationMetrics = {
  operation: TraderOperation;
  total: number;
  revenue: number;
  tax: number;
  costBasis: number;
  netProfit: number;
  roi: number;
};

export type TraderSummary = {
  netProfit: number;
  totalInvested: number;
  totalRevenue: number;
  totalTaxes: number;
  completedSales: number;
  openPositionsCount: number;
  roi: number;
  soldCost: number;
  positions: TraderPosition[];
  recentOperations: TraderOperationMetrics[];
};
