import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findCatalogItemByUniqueName,
  findCatalogItemsByQuery,
  resolveSelectedItemVariant,
} from '../lib/itemSearch';
import { itemAliasesPtBR } from '../data/itemAliases.ptBR';
import type { AlbionItemCatalogEntry } from '../types/items';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(SCRIPT_DIR, '../src/data/itemCatalog.full.json');
const MIN_CATALOG_SIZE = 7000;
const REQUIRED_QUERIES = [
  'cajado invocador da luz',
  'invocador da luz',
  'Dessangra',
  'Bloodletter',
  'Mortíficos',
  'Mortificos',
  'Deathgivers',
  'Capa de Thetford',
  'Thetford Cape',
  'Poção de Cura',
  'Healing Potion',
  'Mochila',
  'Bag',
  'Couro',
  'Barra',
  'Tecido',
  'Omelete',
  'Montaria',
  'T4_BAG',
];

async function main() {
  await access(CATALOG_PATH);
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as AlbionItemCatalogEntry[];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (catalog.length < MIN_CATALOG_SIZE) {
    errors.push(`Catalogo pequeno demais: ${catalog.length} itens. Esperado pelo menos ${MIN_CATALOG_SIZE}.`);
  }

  const withPtBR = catalog.filter((item) => item.namePtBR && item.namePtBR !== item.uniqueName).length;
  const withEn = catalog.filter((item) => item.nameEn && item.nameEn !== item.uniqueName).length;
  if (withPtBR < Math.floor(catalog.length * 0.3)) {
    warnings.push(`Poucos nomes pt-BR detectados: ${withPtBR}/${catalog.length}.`);
  }
  if (withEn < Math.floor(catalog.length * 0.3)) {
    warnings.push(`Poucos nomes EN detectados: ${withEn}/${catalog.length}.`);
  }

  for (const query of REQUIRED_QUERIES) {
    const match =
      query === 'T4_BAG'
        ? findCatalogItemByUniqueName(query) ?? findCatalogItemsByQuery(query, {}, 1)[0]
        : findCatalogItemsByQuery(query, {}, 1)[0];

    if (!match) {
      const aliasRule = itemAliasesPtBR.find((rule) =>
        rule.aliases.some((alias) => normalize(alias) === normalize(query)),
      );
      errors.push(
        `Busca obrigatoria nao encontrou "${query}". ${
          aliasRule ? `Existe alias, verifique uniqueName/pattern: ${aliasRule.uniqueName ?? aliasRule.uniqueNamePattern}` : 'Faltou no catálogo ou nos aliases.'
        }`,
      );
    } else {
      console.info(`OK: "${query}" -> ${match.uniqueName} (${match.namePtBR})`);
    }
  }

  validateVariantResolution(errors);

  for (const warning of warnings) {
    console.warn(`AVISO: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`ERRO: ${error}`);
    process.exitCode = 1;
    return;
  }

  console.info(`Catalogo validado com ${catalog.length} itens.`);
}

function validateVariantResolution(errors: string[]) {
  const deathgivers = findCatalogItemsByQuery('Mortificos', {}, 1)[0];
  if (!deathgivers) {
    errors.push('Não foi possível validar variação T7.1 dos Mortíficos porque a busca não retornou item.');
    return;
  }

  const resolved = resolveSelectedItemVariant(deathgivers, 7, 1);
  if (resolved.uniqueName !== 'T7_2H_DUALSICKLE_UNDEAD@1') {
    errors.push(`Variação incorreta para Mortíficos T7.1: ${resolved.uniqueName}`);
  } else {
    console.info(`OK: Mortíficos T7.1 -> ${resolved.uniqueName}`);
  }

  const bag = findCatalogItemByUniqueName('T4_BAG');
  if (!bag) {
    errors.push('T4_BAG nao encontrado para validacao de Item ID direto.');
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
