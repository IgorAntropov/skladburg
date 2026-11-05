import type { ImportRow } from '@skladburg/contracts/import/v1/import';

import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  ListingPriceSchema,
  ListingSchema,
  MarkingMode,
  ProductSchema,
  VatRate,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';
import {
  ImportRowErrorSchema,
  ImportRowSchema,
} from '@skladburg/contracts/import/v1/import';

import type { IRandom } from '../../ports/index';
import type { IStateReader } from '../../state/index';

import { ImportFileError } from './importLimits';
import { CATALOG_IMPORT_TEMPLATE } from './importTemplate';

export const parseImportMoney = (value: string): bigint => {
  const match = /^([0-9]{1,17})(?:[.,]([0-9]{1,2}))?$/.exec(value);
  const whole = match?.[1];
  if (whole === undefined) {
    throw new RangeError('import.decimal');
  }
  const amount = BigInt(whole) * 100n + BigInt((match?.[2] ?? '').padEnd(2, '0'));
  if (amount > 9223372036854775807n) {
    throw new RangeError('import.decimal');
  }

  return amount;
};

export const readImportColumns = (headers: readonly string[]): string[] => {
  const seen = new Set<string>();
  const keys = headers.map((header, index) => {
    const normalized = header.trim().toLowerCase();
    const column = CATALOG_IMPORT_TEMPLATE.columns.find(candidate => candidate.key === normalized
      || candidate.aliases.some(alias => alias.toLowerCase() === normalized));
    if (column === undefined || seen.has(column.key)) {
      throw new ImportFileError(ImportFileInvalidReason.HEADERS, 1, index + 1, header);
    }
    seen.add(column.key);

    return column.key;
  });
  const missing = CATALOG_IMPORT_TEMPLATE.columns.find(column => column.isRequired && !seen.has(column.key));
  if (missing !== undefined) {
    throw new ImportFileError(ImportFileInvalidReason.HEADERS, 1, 0, missing.key);
  }

  return keys;
};

const readSphereNames = (reader: IStateReader): ReadonlyMap<string, readonly string[]> => {
  const spheres = reader.list('spheres');
  const byId = new Map(spheres.map(sphere => [sphere.id, sphere]));
  const names = new Map<string, string[]>();
  for (const sphere of spheres) {
    const parts = [sphere.name];
    let parentId = sphere.parentId;
    const seen = new Set([sphere.id]);
    while (parentId !== '' && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (parent === undefined) {
        break;
      }
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }
    for (const name of new Set([parts.join(' / '), sphere.name])) {
      const key = name.toLowerCase();
      names.set(key, [...(names.get(key) ?? []), sphere.id]);
    }
  }

  return names;
};

export const mapImportRows = (
  table: readonly (readonly string[])[],
  reader: IStateReader,
  random: IRandom,
  organizationId: string,
): ImportRow[] => {
  const [headers, ...sourceRows] = table;
  const columns = readImportColumns(headers ?? []);
  const spheres = readSphereNames(reader);

  return sourceRows.map((values, index) => {
    const row = create(ImportRowSchema, { rowNumber: index + 2, values: [...values] });
    const valueByKey = new Map(columns.map((key, columnIndex) => [key, (values[columnIndex] ?? '').trim()]));
    const text = (key: string): string => valueByKey.get(key) ?? '';
    const issue = (key: string, ruleId: string): void => {
      const fieldPath = CATALOG_IMPORT_TEMPLATE.columns.find(column => column.key === key)?.fieldPath ?? key;
      row.errors.push(create(ImportRowErrorSchema, {
        columnNumber: columns.indexOf(key) + 1, fieldPath, rowNumber: row.rowNumber, ruleId,
      }));
    };
    const integer = (key: string, isOptional = false): bigint => {
      const value = text(key);
      if (isOptional && value === '') {
        return 0n;
      }
      if (!/^-?[0-9]{1,19}$/.test(value)) {
        issue(key, 'import.integer');
        return 0n;
      }
      const parsed = BigInt(value);
      if (parsed < -9223372036854775808n || parsed > 9223372036854775807n) {
        issue(key, 'import.integer');
        return 0n;
      }
      return parsed;
    };
    const int32 = (key: string, isOptional = false): number => {
      const parsed = integer(key, isOptional);
      if (parsed < -2147483648n || parsed > 2147483647n) {
        issue(key, 'import.integer');
        return 0;
      }
      return Number(parsed);
    };
    const money = (key: string): bigint => {
      try {
        return parseImportMoney(text(key));
      }
      catch {
        issue(key, 'import.decimal');
        return 0n;
      }
    };
    const enumText = (key: string): string => {
      const value = text(key).toLowerCase();
      const found = CATALOG_IMPORT_TEMPLATE.enumValues.find(candidate => candidate.columnKey === key
        && (candidate.value === value || candidate.aliases.includes(value)));
      if (found === undefined) {
        issue(key, 'import.enum');
      }
      return found?.value ?? '';
    };
    if (values.length > columns.length) {
      issue('', 'import.columns');
    }
    const baseUnit = enumText('base_unit');
    const marking = enumText('marking_mode');
    const vat = enumText('vat_rate');
    const productId = random.uuid();
    const listingId = random.uuid();
    const minimumPrice = text('min_price_rub');
    const minimumTemperature = text('temperature_min');
    const maximumTemperature = text('temperature_max');
    const sphereIds = spheres.get(text('sphere').toLowerCase()) ?? [];
    if (sphereIds.length !== 1) {
      issue('sphere', sphereIds.length === 0 ? 'catalog.sphere_exists' : 'import.sphere_ambiguous');
    }
    if ((minimumTemperature === '') !== (maximumTemperature === '')) {
      issue(minimumTemperature === '' ? 'temperature_min' : 'temperature_max', 'import.temperature_pair');
    }
    row.product = create(ProductSchema, {
      baseUnit: baseUnit === 'piece' ? BaseUnit.PIECE : baseUnit === 'gram' ? BaseUnit.GRAM : BaseUnit.MILLILITER,
      gtin: text('gtin'),
      id: productId,
      isDiscountForbidden: text('is_discount_forbidden') === '' ? false : enumText('is_discount_forbidden') === 'true',
      markingMode: marking === 'none' ? MarkingMode.NONE : marking === 'unit' ? MarkingMode.UNIT : MarkingMode.VOLUME,
      minPrice: minimumPrice === '' ? undefined : { amountMinor: money('min_price_rub'), currencyCode: 'RUB' },
      name: text('name'),
      packagings: [{
        baseQuantity: integer('packaging_quantity'),
        grossWeightGrams: integer('gross_weight_grams'),
        heightMillimeters: int32('height_millimeters'),
        id: random.uuid(),
        lengthMillimeters: int32('length_millimeters'),
        name: text('packaging_name'),
        volumeCubicCentimeters: integer('volume_cubic_centimeters'),
        widthMillimeters: int32('width_millimeters'),
      }],
      shelfLifeDays: int32('shelf_life_days', true),
      sku: text('sku'),
      storageTemperature: minimumTemperature === '' && maximumTemperature === ''
        ? undefined
        : {
            maxCelsius: int32('temperature_max'), minCelsius: int32('temperature_min'),
          },
      tenantId: organizationId,
      vatRate: vat === 'none' ? VatRate.VAT_RATE_NONE : vat === '10' ? VatRate.VAT_RATE_10 : VatRate.VAT_RATE_22,
    });
    row.listing = create(ListingSchema, {
      id: listingId,
      minOrderQuantity: integer('min_order_quantity'),
      orderStep: integer('order_step'),
      priceUnit: { baseQuantity: integer('price_unit_base_quantity'), name: text('price_unit_name') },
      productId,
      sphereIds: sphereIds.length === 1 ? [...sphereIds] : [],
      tenantId: organizationId,
    });
    row.price = create(ListingPriceSchema, {
      listingId,
      tenantId: organizationId,
      tiers: [{ minQuantity: row.listing.minOrderQuantity, price: { amountMinor: money('price_rub'), currencyCode: 'RUB' } }],
    });

    return row;
  });
};
