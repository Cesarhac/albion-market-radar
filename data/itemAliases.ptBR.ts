import type { ItemAliasRule } from '@/types/items';

export const itemAliasesPtBR: ItemAliasRule[] = [
  {
    uniqueNamePattern: '^T[4-8]_MAIN_RAPIER_MORGANA(@[1-4])?$',
    aliases: ['dessangra', 'dessangrador', 'bloodletter', 'bl'],
    preferredNamePtBR: 'Dessangra',
    note: 'Bloodletter e conhecida pela comunidade BR como Dessangra.',
  },
  {
    uniqueNamePattern: '^T[4-8]_2H_DUALSICKLE_UNDEAD(@[1-4])?$',
    aliases: ['mortificus', 'mortíficus', 'deathgivers', 'deathgiver', 'morti'],
    note: 'UniqueName validado no dump: Deathgivers usa 2H_DUALSICKLE_UNDEAD.',
  },
  {
    uniqueNamePattern: '^T[3-8]_POTION_HEAL$',
    aliases: ['pocao de cura', 'poção de cura', 'pot de cura', 'healing potion', 'heal potion'],
  },
  {
    uniqueNamePattern: '^T[2-8]_BAG$',
    aliases: ['mochila', 'bag'],
  },
  {
    uniqueName: 'T4_BAG',
    aliases: ['mochila do adepto', 'mochila t4', 'bag t4'],
  },
  {
    uniqueName: 'T5_BAG',
    aliases: ['mochila do perito', 'mochila t5', 'bag t5'],
  },
  {
    uniqueName: 'T6_BAG',
    aliases: ['mochila do mestre', 'mochila t6', 'bag t6'],
  },
  {
    uniqueNamePattern: '^T[4-8]_CAPEITEM_FW_THETFORD(@[1-4])?$',
    aliases: ['capa de thetford', 'thetford cape', 'capa thetford'],
  },
  {
    uniqueNamePattern: '^T[4-8]_2H_HOLYSTAFF$',
    aliases: ['cajado sagrado', 'holy staff', 'cajado holy'],
  },
  {
    uniqueNamePattern: '^T[3-8]_MEAL_OMELETTE$',
    aliases: ['omelete', 'omelet', 'comida omelete'],
  },
  {
    uniqueNamePattern: '^T[2-8]_METALBAR$',
    aliases: ['barra', 'barra de metal', 'bar', 'metal bar'],
  },
  {
    uniqueNamePattern: '^T[2-8]_LEATHER$',
    aliases: ['couro', 'leather'],
  },
  {
    uniqueNamePattern: '^T[2-8]_CLOTH$',
    aliases: ['tecido', 'cloth'],
  },
];
