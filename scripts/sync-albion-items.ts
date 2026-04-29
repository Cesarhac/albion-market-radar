import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AlbionItemCatalogEntry } from '../types/items';

type DumpItem = {
  UniqueName?: string;
  LocalizedNames?: Record<string, string>;
};

const SOURCE_URL =
  'https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json';
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../data/itemCatalog.generated.json',
);

async function main() {
  const source = process.argv.includes('--local')
    ? await readFile(resolve(process.cwd(), 'items.json'), 'utf8')
    : await fetch(SOURCE_URL).then((response) => {
        if (!response.ok) {
          throw new Error(`Falha ao baixar items.json: ${response.status} ${response.statusText}`);
        }

        return response.text();
      });
  const dumpItems = JSON.parse(source) as DumpItem[];
  const catalog = dumpItems
    .map(normalizeDumpItem)
    .filter((item): item is AlbionItemCatalogEntry => Boolean(item))
    .sort((a, b) => {
      const category = (a.category ?? '').localeCompare(b.category ?? '', 'pt-BR');
      if (category !== 0) return category;

      return (a.namePtBR || a.uniqueName).localeCompare(b.namePtBR || b.uniqueName, 'pt-BR');
    });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  if (process.argv.includes('--pretty')) {
    await writeFile(`${OUTPUT_PATH}.pretty.json`, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(catalog)}\n`, 'utf8');

  console.info(`Catálogo gerado com ${catalog.length} itens em ${OUTPUT_PATH}`);
}

function normalizeDumpItem(item: DumpItem): AlbionItemCatalogEntry | null {
  const uniqueName = item.UniqueName?.trim();

  if (!uniqueName || shouldSkipUniqueName(uniqueName)) return null;

  const nameEn = cleanName(item.LocalizedNames?.['EN-US']) || uniqueName;
  const namePtBR = cleanName(item.LocalizedNames?.['PT-BR']) || nameEn;
  const tier = inferTier(uniqueName);
  const enchantment = inferEnchantment(uniqueName);
  const { category, subcategory } = inferCategory(uniqueName, nameEn, namePtBR);

  return {
    uniqueName,
    namePtBR,
    nameEn,
    aliases: [],
    tier,
    enchantment,
    category,
    subcategory,
    marketable: Boolean(tier) && category !== 'Itens',
    iconUrl: `https://render.albiononline.com/v1/item/${encodeURIComponent(uniqueName)}.png`,
    defaultQuality: 'Normal',
  };
}

function cleanName(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function shouldSkipUniqueName(uniqueName: string): boolean {
  return (
    uniqueName.startsWith('UNIQUE_') ||
    uniqueName.startsWith('QUEST_') ||
    uniqueName.includes('_TOKEN') ||
    uniqueName.includes('_SKIN_') ||
    uniqueName.includes('_FURNITURE_') ||
    uniqueName.includes('_JOURNAL_')
  );
}

function inferTier(uniqueName: string): number | undefined {
  const match = /^T([1-8])[_-]/.exec(uniqueName);

  return match ? Number(match[1]) : undefined;
}

function inferEnchantment(uniqueName: string): AlbionItemCatalogEntry['enchantment'] {
  const match = /@([1-4])$/.exec(uniqueName);

  return match ? (Number(match[1]) as AlbionItemCatalogEntry['enchantment']) : 0;
}

function inferCategory(uniqueName: string, nameEn: string, namePtBR: string) {
  const value = `${uniqueName} ${nameEn} ${namePtBR}`.toUpperCase();

  if (value.includes('_BAG')) return { category: 'Bolsas', subcategory: 'Mochila' };
  if (value.includes('_CAPE')) return { category: 'Capas', subcategory: 'Capa' };
  if (value.includes('_MOUNT_') || value.includes('MOUNT_')) return { category: 'Montarias', subcategory: 'Montaria' };
  if (value.includes('_POTION_')) return { category: 'Poções', subcategory: inferPotionSubcategory(value) };
  if (value.includes('_MEAL_')) return { category: 'Comidas', subcategory: inferFoodSubcategory(value) };
  if (/_ORE\b|_WOOD\b|_ROCK\b|_FIBER\b|_HIDE\b/.test(value)) return { category: 'Recursos', subcategory: inferResourceSubcategory(value) };
  if (/_METALBAR\b|_PLANKS\b|_LEATHER\b|_CLOTH\b/.test(value)) return { category: 'Materiais refinados', subcategory: inferRefinedSubcategory(value) };
  if (value.includes('_TOOL_') || value.includes('TOOL_')) return { category: 'Ferramentas', subcategory: 'Coleta' };
  if (value.includes('_ARMOR_') || value.includes('_HEAD_') || value.includes('_SHOES_')) return { category: 'Armaduras', subcategory: inferArmorSubcategory(value) };
  if (/_MAIN_|_2H_|_OFF_/.test(value)) return { category: 'Armas', subcategory: inferWeaponSubcategory(value) };

  return { category: 'Itens', subcategory: undefined };
}

function inferPotionSubcategory(value: string): string {
  if (value.includes('HEAL')) return 'Cura';
  if (value.includes('ENERGY')) return 'Energia';
  if (value.includes('POISON')) return 'Veneno';
  return 'Poção';
}

function inferFoodSubcategory(value: string): string {
  if (value.includes('OMELETTE')) return 'Omelete';
  if (value.includes('STEW')) return 'Ensopado';
  if (value.includes('SOUP')) return 'Sopa';
  if (value.includes('PIE')) return 'Torta';
  if (value.includes('SALAD')) return 'Salada';
  return 'Comida';
}

function inferResourceSubcategory(value: string): string {
  if (value.includes('_ORE')) return 'Minério';
  if (value.includes('_WOOD')) return 'Madeira';
  if (value.includes('_ROCK')) return 'Pedra';
  if (value.includes('_FIBER')) return 'Fibra';
  if (value.includes('_HIDE')) return 'Couro bruto';
  return 'Recurso';
}

function inferRefinedSubcategory(value: string): string {
  if (value.includes('_METALBAR')) return 'Barra';
  if (value.includes('_PLANKS')) return 'Tábua';
  if (value.includes('_LEATHER')) return 'Couro';
  if (value.includes('_CLOTH')) return 'Tecido';
  return 'Material refinado';
}

function inferArmorSubcategory(value: string): string {
  if (value.includes('CLOTH')) return 'Tecido';
  if (value.includes('LEATHER')) return 'Couro';
  if (value.includes('PLATE')) return 'Placa';
  if (value.includes('_HEAD_')) return 'Capacete';
  if (value.includes('_SHOES_')) return 'Botas';
  return 'Armadura';
}

function inferWeaponSubcategory(value: string): string {
  if (value.includes('DAGGER') || value.includes('RAPIER') || value.includes('DUALSICKLE')) return 'Adagas';
  if (value.includes('CROSSBOW')) return 'Bestas';
  if (value.includes('HOLYSTAFF')) return 'Cajados sagrados';
  if (value.includes('BOW')) return 'Arcos';
  if (value.includes('FIRESTAFF')) return 'Cajados de fogo';
  if (value.includes('FROSTSTAFF')) return 'Cajados de gelo';
  if (value.includes('NATURESTAFF')) return 'Cajados naturais';
  if (value.includes('ARCANESTAFF')) return 'Cajados arcanos';
  if (value.includes('CURSEDSTAFF')) return 'Cajados amaldiçoados';
  if (value.includes('SPEAR')) return 'Lanças';
  if (value.includes('SWORD')) return 'Espadas';
  if (value.includes('AXE')) return 'Machados';
  if (value.includes('MACE')) return 'Maças';
  if (value.includes('HAMMER')) return 'Martelos';
  if (value.includes('QUARTERSTAFF')) return 'Bastões';
  return 'Armas';
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
