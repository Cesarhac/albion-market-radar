export type ServerRegion = 'Americas' | 'Europe';

export type ServerParam = 'americas' | 'europe';

export type AlbionCity =
  | 'Bridgewatch'
  | 'Martlock'
  | 'Thetford'
  | 'Fort Sterling'
  | 'Lymhurst'
  | 'Caerleon'
  | 'Brecilien'
  | 'Black Market';

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Enchantment = 0 | 1 | 2 | 3 | 4;

export type Quality = 'Normal' | 'Good' | 'Outstanding' | 'Excellent' | 'Masterpiece';

export type ItemCategory =
  | 'Bolsas'
  | 'Capas'
  | 'Armas'
  | 'Armaduras'
  | 'Poções'
  | 'Comidas'
  | 'Recursos'
  | 'Materiais refinados'
  | 'Montarias'
  | 'Ferramentas'
  | 'Itens';

export type RiskLevel = 'low' | 'medium' | 'high';

export type UpdateStatus = 'updated' | 'medium' | 'outdated';

export type MarketDataSource = 'live' | 'cache' | 'mock';

export type OpportunityType = 'black-market' | 'quick-sale' | 'listed-resale' | 'underpriced';

export type OpportunityConfidence = 'high' | 'medium' | 'low';

export type OpportunitySortBy = 'score' | 'profit' | 'margin' | 'recent' | 'investment';
export type OpportunityWatchlistMode = 'basic' | 'extended';
export type OpportunityScanDepth =
  | 'basic'
  | 'pro'
  | 'deep'
  | 'quick_basic'
  | 'quick_pro'
  | 'quick_deep'
  | 'black_market_basic'
  | 'black_market_pro'
  | 'black_market_deep';
export type OpportunityQuickProfile = 'safe' | 'wide';
export type OpportunityBlackMarketProfile = 'safe' | 'wide' | 'high_profit' | 'low_risk';
export type EstimatedLiquidity = 'alta' | 'média' | 'baixa' | 'desconhecida';

export type OpportunityScoreLabel = 'excellent' | 'good' | 'medium' | 'weak';
export type OpportunityWorthLevel = 'excelente' | 'boa' | 'fraca' | 'micro' | 'suspeita';

export type ListingStatus = 'available' | 'reserved' | 'sold';

export type SubscriptionPlan = 'free' | 'pro';

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'inactive'
  | 'paused';

export type UserAccount = {
  id: string;
  email: string;
  playerName: string;
  playerId?: string;
  guildName?: string;
  allianceName?: string;
  server: ServerParam;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionCurrentPeriodEnd?: string;
  subscriptionCancelAtPeriodEnd?: boolean;
  subscriptionCancelAt?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt: string;
};

export type AuthSession = {
  userId: string;
  email: string;
  playerName: string;
  createdAt: string;
};

export type AlbionPlayerLookup = {
  found: boolean;
  playerName?: string;
  playerId?: string;
  guildName?: string;
  allianceName?: string;
  warning?: string;
};

export type Weapon4ListingType = 'standard-4' | 'awakened';

export type WeaponUseCase = 'PvP' | 'PvE' | 'Mists' | 'Gank' | 'ZvZ' | 'HCE';

export type WeaponTraitRarity = 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário' | '';

export interface CityPrice {
  city: AlbionCity;
  sellPriceMin: number;
  buyPriceMax: number;
  averagePrice: number;
  estimatedVolume: number;
  updatedAt: string;
  sellUpdatedAt?: string;
  buyUpdatedAt?: string;
  updateStatus: UpdateStatus;
  hasMarketData?: boolean;
}

export interface Item {
  itemId: string;
  uniqueName: string;
  nameEn: string;
  namePtBR: string;
  familyId?: string;
  baseNameEn?: string;
  baseNamePtBR?: string;
  resolvedFromUniqueName?: string;
  localizedNames?: Record<string, string>;
  aliases: string[];
  tier: Tier;
  enchantment: Enchantment;
  quality: Quality;
  category: ItemCategory;
  subcategory?: string;
  itemPower?: string;
  prices: CityPrice[];
  dataSource?: MarketDataSource;
  marketNotice?: string;
  hasMarketData?: boolean;
  server?: ServerRegion;
  sourceHost?: string;
}

export interface ItemCatalogEntry {
  itemId: string;
  uniqueName: string;
  nameEn: string;
  namePtBR: string;
  familyId?: string;
  baseNameEn?: string;
  baseNamePtBR?: string;
  resolvedFromUniqueName?: string;
  localizedNames?: Record<string, string>;
  aliases: string[];
  tier: Tier;
  enchantment: Enchantment;
  defaultQuality: Quality;
  category: ItemCategory;
  subcategory?: string;
  itemPower?: string;
  marketable?: boolean;
  iconUrl?: string;
  searchText?: string;
}

export interface Opportunity {
  id: string;
  itemId: string;
  itemName: string;
  itemNameEn?: string;
  category?: ItemCategory;
  subcategory?: string;
  tier: Tier;
  enchantment: Enchantment;
  type?: OpportunityType;
  buyCity: AlbionCity;
  sellCity: AlbionCity;
  buyPrice: number;
  sellPrice: number;
  sellPriceReference?: 'buy-order' | 'sell-order';
  blackMarketBuyPrice?: number;
  blackMarketUpdatedAt?: string;
  blackMarketAgeHours?: number;
  estimatedLiquidity?: EstimatedLiquidity;
  estimatedLiquidityReasons?: string[];
  quantityAvailableLabel?: string;
  quantityAvailableSource?: 'api' | 'not_provided';
  taxRateApplied?: number;
  grossProfit: number;
  estimatedTax: number;
  netProfit: number;
  netProfitPerUnit?: number;
  margin: number;
  roi?: number;
  investment?: number;
  suggestedQuantity?: number;
  estimatedInvestment?: number;
  estimatedNetProfit?: number;
  isMicroFlip?: boolean;
  microFlipReasons?: string[];
  worthLevel?: OpportunityWorthLevel;
  worthReasons?: string[];
  score?: number;
  scoreLabel?: OpportunityScoreLabel;
  scoreReasons?: string[];
  confidence?: OpportunityConfidence;
  confidenceReasons?: string[];
  riskReasons?: string[];
  isSuspicious?: boolean;
  suspicionReasons?: string[];
  referenceMedianPrice?: number;
  priceRatio?: number;
  sellPriceOutlier?: boolean;
  buyPriceOutlier?: boolean;
  buyUpdatedAt?: string;
  sellUpdatedAt?: string;
  maxDataAgeHours?: number;
  priceTable?: CityPrice[];
  risk: RiskLevel;
  server: ServerRegion;
  sourceHost?: string;
  updatedAt: string;
  dataSource?: MarketDataSource;
}

export interface FavoriteItem {
  id: string;
  itemId: string;
  itemName: string;
  targetPrice: number;
  buyCity: AlbionCity;
  sellCity: AlbionCity;
  alertStatus: boolean;
  expectedProfit: number;
  updatedAt: string;
}

export interface UserSettings {
  defaultServer: ServerRegion;
  hasAlbionPremium: boolean;
  mainCity: AlbionCity;
  updateIntervalMinutes: number;
  darkTheme: boolean;
  currency: 'silver';
}

export interface EnchantedWeaponListing {
  id: string;
  weaponName: string;
  itemId: string;
  tier: Tier;
  enchantment: Enchantment;
  quality: Quality;
  city: AlbionCity;
  desiredPrice: number;
  quantity: number;
  sellerName: string;
  sellerContact: string;
  description: string;
  imageLabel: string;
  status: ListingStatus;
  createdAt: string;
}

export type NewEnchantedWeaponListing = Omit<
  EnchantedWeaponListing,
  'id' | 'status' | 'createdAt' | 'imageLabel'
> & {
  imageLabel?: string;
};

export interface Weapon4Trait {
  id: string;
  name: string;
  value: string;
  rarity?: WeaponTraitRarity;
  notes?: string;
}

export interface Weapon4Listing {
  id: string;
  weaponName: string;
  itemId?: string;
  tier: Tier;
  enchantment: 4;
  quality: Quality;
  server: ServerRegion;
  city: AlbionCity;
  askingPrice: number;
  sellerName?: string;
  sellerUserId?: string;
  sellerPlayerName: string;
  sellerPlayerId?: string;
  sellerServer?: ServerParam;
  sellerContact?: string;
  safetyAcceptedAt: string;
  status: ListingStatus;
  description?: string;
  useCases: WeaponUseCase[];
  screenshots: string[];
  notes?: string;
  type: Weapon4ListingType;
  isAwakened: boolean;
  awakened?: boolean;
  awakenedLevel?: number;
  itemPower?: string;
  traits: Weapon4Trait[];
  traitTags?: string[];
  attunementPoints?: string;
  investedCost?: number;
  estimatedInvestment?: number;
  buildNotes?: string;
  discordUsername?: string;
  discordUserId?: string;
  discordInviteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewWeapon4Listing = Omit<Weapon4Listing, 'id' | 'createdAt' | 'updatedAt' | 'type'> & {
  id?: string;
};

export interface ItemSearchFilters {
  tier?: Tier | 'all';
  enchantment?: Enchantment | 'all';
  quality?: Quality | 'all';
  category?: ItemCategory | 'all';
  city?: AlbionCity | 'all';
}

export interface OpportunityFilters {
  minProfit?: number;
  minMargin?: number;
  maxAgeHours?: number;
  risk?: RiskLevel | 'all';
  maxRisk?: RiskLevel | 'all';
  buyCity?: AlbionCity | 'all';
  sellCity?: AlbionCity | 'all';
  tier?: Tier | 'all';
  enchantment?: Enchantment | 'all';
  quality?: Quality | 'all';
  category?: ItemCategory | 'all';
  type?: OpportunityType | 'all';
  budget?: number;
  minEstimatedProfit?: number;
  includeBlackMarket?: boolean;
  includeLowConfidence?: boolean;
  includeSuspicious?: boolean;
  includeMicroFlips?: boolean;
  blackMarketFreshOnly?: boolean;
  blackMarketMaxAgeHours?: number;
  sortBy?: OpportunitySortBy;
  watchlistMode?: OpportunityWatchlistMode;
  minConfidence?: OpportunityConfidence | 'all';
  plan?: SubscriptionPlan;
  scanDepth?: OpportunityScanDepth;
  selectedPreset?: string;
  quickProfile?: OpportunityQuickProfile;
  blackMarketProfile?: OpportunityBlackMarketProfile;
}

export type OpportunityRejectionReasons = {
  noPriceData: number;
  noSellPrice: number;
  noBuyPrice: number;
  sameCity: number;
  negativeProfit: number;
  belowMinProfit: number;
  belowMinMargin: number;
  tooOld: number;
  suspicious: number;
  microFlip: number;
  invalidItemId: number;
  belowEstimatedProfit: number;
  lowConfidence: number;
  highRisk: number;
  weakOpportunity: number;
  staleBlackMarketData: number;
};

export type OpportunityRadarDebug = {
  server: ServerParam;
  plan: SubscriptionPlan;
  scanDepth: OpportunityScanDepth;
  selectedMode: OpportunityType | 'all';
  selectedPreset?: string;
  quickProfile?: OpportunityQuickProfile;
  blackMarketProfile?: OpportunityBlackMarketProfile;
  watchlistSource?: string;
  fallbackReason?: string;
  requestedItemIdsCount: number;
  validItemIdsCount: number;
  staticCatalogItemsCount?: number;
  apiReturnedRows: number;
  fetchErrors?: string[];
  itemsWithAnyPrice: number;
  itemsWithSellPrice: number;
  itemsWithBuyPrice: number;
  rawCandidatesCount: number;
  afterPositiveProfitCount: number;
  afterMinProfitCount: number;
  afterMinMarginCount: number;
  afterAgeFilterCount: number;
  afterSuspiciousFilterCount: number;
  afterMicroFlipFilterCount: number;
  finalOpportunitiesCount: number;
  rejectionReasons: OpportunityRejectionReasons;
};

export interface ProfitBreakdown {
  grossProfit: number;
  estimatedTax: number;
  netProfit: number;
  margin: number;
}

export interface AlbionDataPriceResponse {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
}

export interface AlbionDataHistoryResponse {
  item_id: string;
  location: string;
  quality: number;
  data: Array<{
    timestamp: string;
    item_count: number;
    avg_price: number;
  }>;
}

export interface MarketResponseMeta {
  server: ServerParam;
  serverLabel: string;
  sourceHost: string;
  requestedLocations: AlbionCity[];
  requestedQualities: number[];
  fetchedAt: string;
  source: MarketDataSource;
  message?: string;
}

export interface MarketPricesResponse extends MarketResponseMeta {
  itemId: string;
  item: Item | null;
  data: CityPrice[];
}

export interface MarketOpportunitiesResponse extends MarketResponseMeta {
  opportunities: Opportunity[];
  monitoredItemIds: string[];
  analyzedItems?: number;
  evaluatedRoutes?: number;
  displayedOpportunities?: number;
  analyzedAt?: string;
  filters?: OpportunityFilters;
  debug?: OpportunityRadarDebug;
}

export interface MarketHistoryResponse extends MarketResponseMeta {
  itemId: string;
  location: AlbionCity;
  quality: number;
  timeScale: number;
  data: AlbionDataHistoryResponse['data'];
}
