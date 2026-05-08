import type { Enchantment, Tier } from '@/types/albion';

type WatchlistGroup = {
  label: string;
  itemIds: string[];
};

const DEFAULT_TIERS: Tier[] = [4, 5, 6, 7, 8];
const PVP_TIERS: Tier[] = [5, 6, 7];
const BASIC_ENCHANTMENTS: Enchantment[] = [0, 1];
const CONSUMABLE_ENCHANTMENTS: Enchantment[] = [0, 1];
const QUICK_RESALE_ENCHANTMENTS: Enchantment[] = [0, 1, 2, 3];
const BLACK_MARKET_ENCHANTMENTS: Enchantment[] = [0, 1, 2, 3];

function variants(familyId: string, tiers = DEFAULT_TIERS, enchantments = BASIC_ENCHANTMENTS) {
  return tiers.flatMap((tier) =>
    enchantments.map((enchantment) => {
      const base = `T${tier}_${familyId}`;

      return enchantment > 0 ? `${base}@${enchantment}` : base;
    }),
  );
}

function flat<T>(values: T[][]): T[] {
  return values.flat();
}

export const BASIC_WATCHLIST_GROUPS: Record<string, WatchlistGroup> = {
  consumiveis: {
    label: 'Poções e comidas essenciais',
    itemIds: [
      'T4_POTION_HEAL',
      'T6_POTION_HEAL',
      'T4_POTION_ENERGY',
      'T6_POTION_COOLDOWN',
      ...variants('MEAL_OMELETTE', [5, 7], [0]),
      ...variants('MEAL_STEW', [4, 6], [0]),
    ],
  },
  regearBasico: {
    label: 'Regear basico',
    itemIds: flat([
      variants('BAG', [4, 5, 6], [0, 1]),
      variants('CAPE', [4, 5, 6], [0, 1]),
      variants('ARMOR_LEATHER_SET1', [5, 6], [0, 1]),
      variants('HEAD_LEATHER_SET1', [5, 6], [0, 1]),
      variants('SHOES_LEATHER_SET1', [5, 6], [0, 1]),
    ]),
  },
  recursosBasicos: {
    label: 'Refinados comuns',
    itemIds: [
      'T4_METALBAR',
      'T5_METALBAR',
      'T6_METALBAR',
      'T4_PLANKS',
      'T5_PLANKS',
      'T6_PLANKS',
      'T4_LEATHER',
      'T5_LEATHER',
      'T6_LEATHER',
      'T4_CLOTH',
      'T5_CLOTH',
      'T6_CLOTH',
    ],
  },
};

export const OPPORTUNITY_WATCHLIST_GROUPS: Record<string, WatchlistGroup> = {
  armasPopulares: {
    label: 'Armas populares',
    itemIds: flat([
      variants('MAIN_RAPIER_MORGANA', PVP_TIERS, [0, 1, 2]),
      variants('2H_DUALSICKLE_UNDEAD', PVP_TIERS, [0, 1]),
      variants('MAIN_DAGGERPAIR', PVP_TIERS, [0, 1]),
      variants('2H_BOW', PVP_TIERS, [0, 1]),
      variants('2H_BOW_AVALON', PVP_TIERS, [0, 1]),
      variants('MAIN_FIRESTAFF', PVP_TIERS, [0, 1]),
      variants('2H_HOLYSTAFF_UNDEAD', PVP_TIERS, [0, 1]),
      variants('MAIN_SPEAR', PVP_TIERS, [0, 1]),
      variants('2H_CLAYMORE', PVP_TIERS, [0, 1]),
      variants('2H_CROSSBOW', PVP_TIERS, [0, 1]),
    ]),
  },
  regearComum: {
    label: 'Itens comuns de regear',
    itemIds: flat([
      variants('ARMOR_LEATHER_SET1', PVP_TIERS, [0, 1]),
      variants('ARMOR_LEATHER_SET2', PVP_TIERS, [0, 1]),
      variants('ARMOR_CLOTH_SET1', PVP_TIERS, [0, 1]),
      variants('ARMOR_PLATE_SET1', PVP_TIERS, [0, 1]),
      variants('HEAD_LEATHER_SET1', PVP_TIERS, [0, 1]),
      variants('HEAD_CLOTH_SET1', PVP_TIERS, [0, 1]),
      variants('SHOES_LEATHER_SET1', PVP_TIERS, [0, 1]),
      variants('SHOES_CLOTH_SET1', PVP_TIERS, [0, 1]),
    ]),
  },
  armadurasPopulares: {
    label: 'Armaduras populares',
    itemIds: flat([
      variants('ARMOR_CLOTH_SET1', PVP_TIERS, [0, 1, 2]),
      variants('ARMOR_CLOTH_SET2', PVP_TIERS, [0, 1]),
      variants('ARMOR_CLOTH_KEEPER', PVP_TIERS, [0, 1]),
      variants('ARMOR_LEATHER_SET1', PVP_TIERS, [0, 1, 2]),
      variants('ARMOR_LEATHER_SET2', PVP_TIERS, [0, 1]),
      variants('ARMOR_LEATHER_MORGANA', PVP_TIERS, [0, 1]),
      variants('ARMOR_PLATE_SET1', PVP_TIERS, [0, 1, 2]),
      variants('ARMOR_PLATE_SET3', PVP_TIERS, [0, 1]),
    ]),
  },
  botasPopulares: {
    label: 'Botas populares',
    itemIds: flat([
      variants('SHOES_CLOTH_SET1', PVP_TIERS, [0, 1, 2]),
      variants('SHOES_CLOTH_SET2', PVP_TIERS, [0, 1]),
      variants('SHOES_LEATHER_SET1', PVP_TIERS, [0, 1, 2]),
      variants('SHOES_LEATHER_SET2', PVP_TIERS, [0, 1]),
      variants('SHOES_PLATE_SET1', PVP_TIERS, [0, 1, 2]),
      variants('SHOES_PLATE_SET3', PVP_TIERS, [0, 1]),
    ]),
  },
  capacetesPopulares: {
    label: 'Capacetes populares',
    itemIds: flat([
      variants('HEAD_CLOTH_SET1', PVP_TIERS, [0, 1, 2]),
      variants('HEAD_CLOTH_SET2', PVP_TIERS, [0, 1]),
      variants('HEAD_LEATHER_SET1', PVP_TIERS, [0, 1, 2]),
      variants('HEAD_LEATHER_SET2', PVP_TIERS, [0, 1]),
      variants('HEAD_PLATE_SET1', PVP_TIERS, [0, 1, 2]),
      variants('HEAD_PLATE_SET3', PVP_TIERS, [0, 1]),
    ]),
  },
  bolsasECapas: {
    label: 'Bolsas e capas',
    itemIds: flat([
      variants('BAG', DEFAULT_TIERS, [0, 1]),
      variants('BAG_INSIGHT', [5, 6, 7, 8], [0, 1]),
      variants('CAPE', DEFAULT_TIERS, [0, 1]),
      variants('CAPEITEM_FW_THETFORD', PVP_TIERS, [0, 1]),
      variants('CAPEITEM_FW_FORTSTERLING', PVP_TIERS, [0, 1]),
      variants('CAPEITEM_FW_LYMHURST', PVP_TIERS, [0, 1]),
      variants('CAPEITEM_FW_BRIDGEWATCH', PVP_TIERS, [0, 1]),
      variants('CAPEITEM_FW_MARTLOCK', PVP_TIERS, [0, 1]),
    ]),
  },
  pocoesEComidas: {
    label: 'Poções e comidas',
    itemIds: [
      'T4_POTION_HEAL',
      'T4_POTION_HEAL@1',
      'T6_POTION_HEAL',
      'T6_POTION_HEAL@1',
      'T4_POTION_ENERGY',
      'T4_POTION_ENERGY@1',
      'T6_POTION_ENERGY',
      'T6_POTION_ENERGY@1',
      'T4_POTION_COOLDOWN',
      'T4_POTION_COOLDOWN@1',
      'T6_POTION_COOLDOWN',
      'T6_POTION_COOLDOWN@1',
      'T8_POTION_COOLDOWN',
      'T8_POTION_COOLDOWN@1',
      'T5_POTION_STONESKIN',
      'T5_POTION_STONESKIN@1',
      'T7_POTION_STONESKIN',
      'T7_POTION_STONESKIN@1',
      ...variants('MEAL_OMELETTE', [5, 7], CONSUMABLE_ENCHANTMENTS),
      ...variants('MEAL_STEW', [4, 6, 8], CONSUMABLE_ENCHANTMENTS),
      ...variants('MEAL_SANDWICH', [4, 6, 8], CONSUMABLE_ENCHANTMENTS),
      ...variants('MEAL_PIE', [3, 5, 7], CONSUMABLE_ENCHANTMENTS),
    ],
  },
  recursosERefinados: {
    label: 'Recursos e refinados',
    itemIds: [
      'T4_METALBAR',
      'T5_METALBAR',
      'T6_METALBAR',
      'T7_METALBAR',
      'T8_METALBAR',
      'T4_PLANKS',
      'T5_PLANKS',
      'T6_PLANKS',
      'T7_PLANKS',
      'T8_PLANKS',
      'T4_LEATHER',
      'T5_LEATHER',
      'T6_LEATHER',
      'T7_LEATHER',
      'T8_LEATHER',
      'T4_CLOTH',
      'T5_CLOTH',
      'T6_CLOTH',
      'T7_CLOTH',
      'T8_CLOTH',
      'T4_ORE',
      'T5_ORE',
      'T6_ORE',
      'T7_ORE',
      'T8_ORE',
      'T4_WOOD',
      'T5_WOOD',
      'T6_WOOD',
      'T7_WOOD',
      'T8_WOOD',
    ],
  },
  montarias: {
    label: 'Montarias',
    itemIds: [
      'T4_MOUNT_HORSE',
      'T5_MOUNT_HORSE',
      'T6_MOUNT_HORSE',
      'T7_MOUNT_HORSE',
      'T4_MOUNT_OX',
      'T5_MOUNT_OX',
      'T6_MOUNT_OX',
      'T7_MOUNT_OX',
      'T5_MOUNT_ARMORED_HORSE',
      'T6_MOUNT_ARMORED_HORSE',
      'T7_MOUNT_ARMORED_HORSE',
      'T5_MOUNT_COUGAR_KEEPER@1',
      'T6_MOUNT_DIREWOLF',
      'T4_MOUNT_GIANTSTAG',
    ],
  },
};

export const QUICK_RESALE_WATCHLIST_GROUPS: Record<string, WatchlistGroup> = {
  capasLiquidas: {
    label: 'Capas liquidas',
    itemIds: flat([
      variants('CAPE', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_THETFORD', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_BRIDGEWATCH', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_MARTLOCK', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_LYMHURST', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_FORTSTERLING', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_CAERLEON', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CAPEITEM_FW_BRECILIEN', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
    ]),
  },
  bolsasLiquidas: {
    label: 'Bolsas liquidas',
    itemIds: flat([
      variants('BAG', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('BAG_INSIGHT', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
    ]),
  },
  armadurasComuns: {
    label: 'Armaduras, capacetes e botas comuns',
    itemIds: flat([
      variants('ARMOR_CLOTH_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_CLOTH_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_CLOTH_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_PLATE_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_PLATE_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('HEAD_PLATE_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_PLATE_SET1', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_PLATE_SET2', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('SHOES_PLATE_SET3', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
    ]),
  },
  armasLiquidas: {
    label: 'Armas liquidas',
    itemIds: flat([
      variants('MAIN_RAPIER_MORGANA', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_DUALSICKLE_UNDEAD', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_DAGGER', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_DAGGERPAIR', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_DAGGER_KATAR_AVALON', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_BOW', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_BOW_AVALON', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_CROSSBOW', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_SWORD', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_CLAYMORE', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_AXE', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_AXE', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_SPEAR', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_SPEAR', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_HAMMER', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('2H_HAMMER', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_FIRESTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_FROSTSTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_ARCANESTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_CURSEDSTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_HOLYSTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('MAIN_NATURESTAFF', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
    ]),
  },
  consumiveisLiquidos: {
    label: 'Consumiveis liquidos',
    itemIds: flat([
      variants('POTION_HEAL', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('POTION_ENERGY', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('POTION_STONESKIN', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('POTION_COOLDOWN', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('POTION_ACID', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('MEAL_OMELETTE', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('MEAL_OMELETTE_FISH', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('MEAL_STEW', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('MEAL_SANDWICH', DEFAULT_TIERS, [0, 1, 2, 3]),
      variants('MEAL_PIE', DEFAULT_TIERS, [0, 1, 2, 3]),
    ]),
  },
  refinadosLiquidos: {
    label: 'Refinados liquidos',
    itemIds: flat([
      variants('METALBAR', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('PLANKS', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('LEATHER', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('CLOTH', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
      variants('STONEBLOCK', DEFAULT_TIERS, QUICK_RESALE_ENCHANTMENTS),
    ]),
  },
};

export const BLACK_MARKET_WATCHLIST_GROUPS: Record<string, WatchlistGroup> = {
  equipamentosComuns: {
    label: 'Equipamentos comuns para Mercado Negro',
    itemIds: flat([
      variants('ARMOR_CLOTH_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_CLOTH_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_CLOTH_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_LEATHER_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_PLATE_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_CLOTH_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_LEATHER_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_PLATE_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_PLATE_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_PLATE_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_CLOTH_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_LEATHER_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_PLATE_SET1', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_PLATE_SET2', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_PLATE_SET3', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
    ]),
  },
  armasComuns: {
    label: 'Armas comuns para Mercado Negro',
    itemIds: flat([
      variants('MAIN_SWORD', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_CLAYMORE', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_AXE', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_AXE', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_BOW', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_CROSSBOW', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_SPEAR', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_SPEAR', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_HAMMER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_HAMMER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_DAGGER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_DAGGERPAIR', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_FIRESTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_FROSTSTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_ARCANESTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_CURSEDSTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_HOLYSTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('MAIN_NATURESTAFF', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
    ]),
  },
  armasPvPPvEPopulares: {
    label: 'Itens populares PvE e PvP para Mercado Negro',
    itemIds: flat([
      variants('MAIN_RAPIER_MORGANA', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_DUALSICKLE_UNDEAD', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_BOW_AVALON', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_DAGGER_KATAR_AVALON', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('2H_HOLYSTAFF_UNDEAD', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_CLOTH_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_LEATHER_MORGANA', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('ARMOR_PLATE_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_CLOTH_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_LEATHER_MORGANA', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('HEAD_PLATE_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_CLOTH_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_LEATHER_MORGANA', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
      variants('SHOES_PLATE_KEEPER', DEFAULT_TIERS, BLACK_MARKET_ENCHANTMENTS),
    ]),
  },
};

export const OPPORTUNITY_WATCHLIST_ITEM_IDS = Array.from(
  new Set(Object.values(OPPORTUNITY_WATCHLIST_GROUPS).flatMap((group) => group.itemIds)),
);

export const BASIC_WATCHLIST_ITEM_IDS = Array.from(
  new Set(Object.values(BASIC_WATCHLIST_GROUPS).flatMap((group) => group.itemIds)),
);

export const EXTENDED_WATCHLIST_GROUPS = OPPORTUNITY_WATCHLIST_GROUPS;
export const EXTENDED_WATCHLIST_ITEM_IDS = OPPORTUNITY_WATCHLIST_ITEM_IDS;

export const QUICK_RESALE_WATCHLIST = QUICK_RESALE_WATCHLIST_GROUPS;
export const QUICK_RESALE_WATCHLIST_ITEM_IDS = Array.from(
  new Set(Object.values(QUICK_RESALE_WATCHLIST_GROUPS).flatMap((group) => group.itemIds)),
);

export const BLACK_MARKET_WATCHLIST = BLACK_MARKET_WATCHLIST_GROUPS;
export const BLACK_MARKET_WATCHLIST_ITEM_IDS = Array.from(
  new Set(Object.values(BLACK_MARKET_WATCHLIST_GROUPS).flatMap((group) => group.itemIds)),
);

// Futuro: trocar essa watchlist local por backend com banco, cron por servidor,
// cache de preços e análise de milhares de itens em lotes.
