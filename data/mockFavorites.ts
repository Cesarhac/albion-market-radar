import type { FavoriteItem } from '@/types/albion';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const mockFavorites: FavoriteItem[] = [
  {
    id: 'favorite-t4-bag',
    itemId: 'T4_BAG',
    itemName: 'Mochila do Adepto',
    targetPrice: 3900,
    buyCity: 'Lymhurst',
    sellCity: 'Black Market',
    alertStatus: true,
    expectedProfit: 922,
    updatedAt: minutesAgo(7),
  },
  {
    id: 'favorite-bloodletter',
    itemId: 'T6_MAIN_RAPIER_MORGANA@2',
    itemName: 'Dessangrador do Mestre',
    targetPrice: 132000,
    buyCity: 'Lymhurst',
    sellCity: 'Black Market',
    alertStatus: true,
    expectedProfit: 44747,
    updatedAt: minutesAgo(31),
  },
  {
    id: 'favorite-healing-potion',
    itemId: 'T6_POTION_HEAL',
    itemName: 'Poção de Cura',
    targetPrice: 1100,
    buyCity: 'Thetford',
    sellCity: 'Caerleon',
    alertStatus: false,
    expectedProfit: 254,
    updatedAt: minutesAgo(10),
  },
];
