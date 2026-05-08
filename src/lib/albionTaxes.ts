export const MARKET_SETUP_FEE_RATE = 0.025;
export const PREMIUM_TRANSACTION_TAX_RATE = 0.04;
export const NON_PREMIUM_TRANSACTION_TAX_RATE = 0.08;

export function getTransactionTaxRate(hasPremium: boolean) {
  return hasPremium ? PREMIUM_TRANSACTION_TAX_RATE : NON_PREMIUM_TRANSACTION_TAX_RATE;
}

export function getSellOrderTotalFeeRate(hasPremium: boolean) {
  return MARKET_SETUP_FEE_RATE + getTransactionTaxRate(hasPremium);
}

export function getBuyOrderSetupFeeRate() {
  return MARKET_SETUP_FEE_RATE;
}

export function calculateInstantSellNetRevenue(sellPrice: number, hasPremium: boolean) {
  const transactionTaxRate = getTransactionTaxRate(hasPremium);

  return sellPrice * (1 - transactionTaxRate);
}

export function calculateSellOrderNetRevenue(sellPrice: number, hasPremium: boolean) {
  const totalFeeRate = getSellOrderTotalFeeRate(hasPremium);

  return sellPrice * (1 - totalFeeRate);
}

export function calculateBuyOrderTotalCost(buyPrice: number) {
  return buyPrice * (1 + MARKET_SETUP_FEE_RATE);
}

export function calculateInstantSellProfitBreakdown(
  buyPrice: number,
  sellPrice: number,
  hasPremium: boolean,
) {
  return calculateProfitBreakdownWithFeeRate(buyPrice, sellPrice, getTransactionTaxRate(hasPremium));
}

export function calculateSellOrderProfitBreakdown(
  buyPrice: number,
  sellPrice: number,
  hasPremium: boolean,
) {
  return calculateProfitBreakdownWithFeeRate(buyPrice, sellPrice, getSellOrderTotalFeeRate(hasPremium));
}

export function calculateProfitBreakdownWithFeeRate(
  buyPrice: number,
  sellPrice: number,
  feeRate: number,
) {
  const grossProfit = sellPrice - buyPrice;
  const estimatedTax = sellPrice * feeRate;
  const netProfit = grossProfit - estimatedTax;
  const margin = buyPrice > 0 ? (netProfit / buyPrice) * 100 : 0;

  return {
    grossProfit,
    estimatedTax,
    netProfit,
    margin,
  };
}

export function getAlbionTaxSummary(hasPremium: boolean) {
  return {
    hasPremium,
    transactionTaxRate: getTransactionTaxRate(hasPremium),
    sellOrderTotalFeeRate: getSellOrderTotalFeeRate(hasPremium),
    buyOrderSetupFeeRate: getBuyOrderSetupFeeRate(),
  };
}
