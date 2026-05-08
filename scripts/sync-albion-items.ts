import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemAliasesPtBR } from '../data/itemAliases.ptBR';
import type { AlbionItemCatalogEntry } from '../types/items';

type RawDumpItem = Record<string, unknown>;

export const ITEMS_SOURCE_URLS = [
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json',
  'https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json',
];

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../src/data/itemCatalog.full.json');
const LEGACY_OUTPUT_PATH = resolve(SCRIPT_DIR, '../data/itemCatalog.generated.json');
const LOCAL_INPUT_PATH = resolve(process.cwd(), 'items.json');

async function main() {
  const source = process.argv.includes('--local')
    ? await readFile(LOCAL_INPUT_PATH, 'utf8')
    : await fetchFirstAvailableSource();
  const raw = JSON.parse(source);
  const dumpItems = normalizeDumpRoot(raw);
  const catalog = dumpItems
    .map(normalizeDumpItem)
    .filter((item): item is AlbionItemCatalogEntry => Boolean(item))
    .sort((a, b) => {
      const category = (a.category ?? '').localeCompare(b.category ?? '', 'pt-BR');
      if (category !== 0) return category;

      return (a.namePtBR || a.uniqueName).localeCompare(b.namePtBR || b.uniqueName, 'pt-BR');
    });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await mkdir(dirname(LEGACY_OUTPUT_PATH), { recursive: true });

  if (process.argv.includes('--pretty')) {
    await writeFile(`${OUTPUT_PATH}.pretty.json`, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(catalog)}\n`, 'utf8');
  await writeFile(LEGACY_OUTPUT_PATH, `${JSON.stringify(catalog)}\n`, 'utf8');

  const warnings = validateAliasRules(catalog);
  for (const warning of warnings) {
    console.warn(warning);
  }

  console.info(`Catalogo completo gerado com ${catalog.length} itens em ${OUTPUT_PATH}`);
  console.info('Aliases manuais permanecem separados em data/itemAliases.ptBR.ts.');
}

async function fetchFirstAvailableSource(): Promise<string> {
  const errors: string[] = [];

  for (const url of ITEMS_SOURCE_URLS) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        errors.push(`${url}: ${response.status} ${response.statusText}`);
        continue;
      }

      console.info(`Baixando catálogo de itens de ${url}`);
      return response.text();
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Nenhuma fonte de items.json respondeu.\n${errors.join('\n')}`);
}

function normalizeDumpRoot(raw: unknown): RawDumpItem[] {
  if (Array.isArray(raw)) return raw.filter(isRawObject);

  if (isRawObject(raw)) {
    for (const key of ['items', 'Items', 'data', 'Data']) {
      const value = raw[key];
      if (Array.isArray(value)) return value.filter(isRawObject);
    }
  }

  throw new Error('Formato de items.json nao reconhecido.');
}

function normalizeDumpItem(item: RawDumpItem): AlbionItemCatalogEntry | null {
  const uniqueName = getStringValue(item, ['UniqueName', 'uniqueName', 'uniquename', 'unique_name']);

  if (!uniqueName || shouldSkipUniqueName(uniqueName)) return null;

  const localizedNames = extractLocalizedNames(item);
  const nameEn = cleanName(getLocalizedName(item, 'en-US')) || uniqueName;
  const namePtBR = cleanName(getLocalizedName(item, 'pt-BR')) || nameEn;
  const tier = inferTier(uniqueName);
  const enchantment = inferEnchantment(uniqueName);
  const { category, subcategory } = inferCategory(item, uniqueName, nameEn, namePtBR);
  const marketable = inferMarketable(item, tier, category);
  const searchText = buildSearchText({
    uniqueName,
    namePtBR,
    nameEn,
    localizedNames,
    category,
    subcategory,
  });

  return {
    uniqueName,
    namePtBR,
    nameEn,
    localizedNames,
    aliases: [],
    tier,
    enchantment,
    category,
    subcategory,
    marketable,
    searchText,
    iconUrl: `https://render.albiononline.com/v1/item/${encodeURIComponent(uniqueName)}.png`,
    defaultQuality: 'Normal',
  };
}

export function getLocalizedName(rawItem: RawDumpItem, locale: string): string {
  const names = extractLocalizedNames(rawItem);
  const localeOrder =
    normalizeLocaleKey(locale) === 'en-us'
      ? ['EN-US', 'en-US', 'English', 'English (US)', 'pt-BR', 'PT-BR', 'Portuguese (Brazil)']
      : ['pt-BR', 'PT-BR', 'Portuguese (Brazil)', 'EN-US', 'en-US'];

  for (const key of localeOrder) {
    const value = getLocalizedValue(names, key);
    if (value) return value;
  }

  return Object.values(names).map(cleanName).find(Boolean) ?? getStringValue(rawItem, ['UniqueName', 'uniqueName']) ?? '';
}

function extractLocalizedNames(rawItem: RawDumpItem): Record<string, string> {
  const source =
    getObjectValue(rawItem, ['LocalizedNames', 'localizedNames', 'localizednames', 'localized_names']) ??
    getObjectValue(rawItem, ['LocalizationNameVariable', 'localizationNameVariable']) ??
    {};
  const localizedNames: Record<string, string> = {};

  if (isRawObject(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') {
        const cleanValue = cleanName(value);
        if (cleanValue) localizedNames[key] = cleanValue;
      }
    }
  }

  return localizedNames;
}

function getLocalizedValue(names: Record<string, string>, key: string): string {
  const normalizedKey = normalizeLocaleKey(key);
  const exact = names[key];
  if (exact) return cleanName(exact);

  for (const [candidateKey, value] of Object.entries(names)) {
    if (normalizeLocaleKey(candidateKey) === normalizedKey) return cleanName(value);
  }

  return '';
}

function normalizeLocaleKey(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, '-');
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function getStringValue(item: RawDumpItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return '';
}

function getBooleanValue(item: RawDumpItem, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (['true', 'yes', '1'].includes(normalized)) return true;
      if (['false', 'no', '0'].includes(normalized)) return false;
    }
  }

  return undefined;
}

function getObjectValue(item: RawDumpItem, keys: string[]): unknown {
  for (const key of keys) {
    const value = item[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }

  return undefined;
}

function isRawObject(value: unknown): value is RawDumpItem {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function inferMarketable(item: RawDumpItem, tier: number | undefined, category: string): boolean {
  const explicit = getBooleanValue(item, ['marketable', 'Marketable', 'tradable', 'Tradable', 'CanTrade', 'canTrade']);
  if (explicit !== undefined) return explicit;

  return Boolean(tier) && category !== 'Itens';
}

function inferCategory(item: RawDumpItem, uniqueName: string, nameEn: string, namePtBR: string) {
  const shopCategory = getStringValue(item, ['shopcategory', 'shopCategory', 'ShopCategory']);
  const shopSubcategory = getStringValue(item, ['shopsubcategory', 'shopSubcategory', 'ShopSubcategory']);
  const value = `${uniqueName} ${nameEn} ${namePtBR} ${shopCategory} ${shopSubcategory}`.toUpperCase();

  if (shopCategory || shopSubcategory) {
    const inferred = inferCategoryFromText(value);
    return {
      category: inferred.category,
      subcategory: shopSubcategory || inferred.subcategory,
    };
  }

  return inferCategoryFromText(value);
}

function inferCategoryFromText(value: string) {
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
  if (value.includes('SHAPESHIFTER')) return 'Cajados metamorfos';
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

function buildSearchText({
  uniqueName,
  namePtBR,
  nameEn,
  localizedNames,
  category,
  subcategory,
}: {
  uniqueName: string;
  namePtBR: string;
  nameEn: string;
  localizedNames: Record<string, string>;
  category: string;
  subcategory?: string;
}) {
  return normalizeSearchText([
    uniqueName,
    namePtBR,
    nameEn,
    category,
    subcategory ?? '',
    ...Object.values(localizedNames),
  ].join(' '));
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateAliasRules(catalog: AlbionItemCatalogEntry[]): string[] {
  const warnings: string[] = [];
  const uniqueNames = new Set(catalog.map((item) => item.uniqueName.toUpperCase()));
  const uniqueNameList = catalog.map((item) => item.uniqueName);

  for (const rule of itemAliasesPtBR) {
    if (rule.uniqueName && !uniqueNames.has(rule.uniqueName.toUpperCase())) {
      const fallback = findCatalogCandidateForAliases(catalog, rule.aliases);
      warnings.push(
        `[aliases] UniqueName nao encontrado para alias "${rule.aliases[0]}": ${rule.uniqueName}` +
          (fallback ? `. Possível candidato: ${fallback.uniqueName}` : '.'),
      );
    }

    if (rule.uniqueNamePattern) {
      const pattern = new RegExp(rule.uniqueNamePattern, 'i');
      if (!uniqueNameList.some((uniqueName) => pattern.test(uniqueName))) {
        const fallback = findCatalogCandidateForAliases(catalog, rule.aliases);
        warnings.push(
          `[aliases] Pattern sem correspondencia para alias "${rule.aliases[0]}": ${rule.uniqueNamePattern}` +
            (fallback ? `. Possível candidato: ${fallback.uniqueName}` : '.'),
        );
      }
    }
  }

  return warnings;
}

function findCatalogCandidateForAliases(catalog: AlbionItemCatalogEntry[], aliases: string[]) {
  const aliasTerms = aliases.map(normalizeSearchText).filter((alias) => alias.length >= 3);

  return catalog.find((item) => {
    const searchText = item.searchText ?? normalizeSearchText(`${item.uniqueName} ${item.namePtBR} ${item.nameEn ?? ''}`);
    return aliasTerms.some((alias) => searchText.includes(alias));
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
