import type { Enchantment, Tier } from '@/types/albion';

type WatchlistGroup = {
  label: string;
  itemIds: string[];
};

const DEFAULT_TIERS: Tier[] = [4, 5, 6, 7, 8];
const PVP_TIERS: Tier[] = [5, 6, 7];
const BASIC_ENCHANTMENTS: Enchantment[] = [0, 1];
const CONSUMABLE_ENCHANTMENTS: Enchantment[] = [0, 1];

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

export const OPPORTUNITY_WATCHLIST_ITEM_IDS = Array.from(
  new Set(Object.values(OPPORTUNITY_WATCHLIST_GROUPS).flatMap((group) => group.itemIds)),
);

// Futuro: trocar essa watchlist local por backend com banco, cron por servidor,
// cache de preços e análise de milhares de itens em lotes.
