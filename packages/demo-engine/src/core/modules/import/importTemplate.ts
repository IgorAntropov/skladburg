import { create } from '@bufbuild/protobuf';
import {
  ImportColumnSchema,
  ImportEnumValueSchema,
  ImportTemplateSchema,
} from '@skladburg/contracts/import/v1/import';

const COLUMN_DATA = [
  ['name', 'name', true, 'Наименование'],
  ['sku', 'sku', true, 'Артикул'],
  ['gtin', 'gtin', false, 'Штрихкод'],
  ['base_unit', 'base_unit', true, 'Базовая единица'],
  ['marking_mode', 'marking_mode', true, 'Маркировка'],
  ['vat_rate', 'vat_rate', true, 'НДС'],
  ['packaging_name', 'packagings[0].name', true, 'Упаковка'],
  ['packaging_quantity', 'packagings[0].base_quantity', true, 'Количество в упаковке'],
  ['gross_weight_grams', 'packagings[0].gross_weight_grams', true, 'Вес брутто г'],
  ['volume_cubic_centimeters', 'packagings[0].volume_cubic_centimeters', true, 'Объём см3'],
  ['length_millimeters', 'packagings[0].length_millimeters', true, 'Длина мм'],
  ['width_millimeters', 'packagings[0].width_millimeters', true, 'Ширина мм'],
  ['height_millimeters', 'packagings[0].height_millimeters', true, 'Высота мм'],
  ['sphere', 'sphere_ids', true, 'Сфера'],
  ['price_unit_name', 'price_unit.name', true, 'Единица цены'],
  ['price_unit_base_quantity', 'price_unit.base_quantity', true, 'Количество в единице цены'],
  ['min_order_quantity', 'min_order_quantity', true, 'Минимальный заказ'],
  ['order_step', 'order_step', true, 'Шаг заказа'],
  ['price_rub', 'tiers[0].price.amount_minor', true, 'Цена руб'],
  ['shelf_life_days', 'shelf_life_days', false, 'Срок годности дней'],
  ['temperature_min', 'storage_temperature.min_celsius', false, 'Температура минимум'],
  ['temperature_max', 'storage_temperature.max_celsius', false, 'Температура максимум'],
  ['min_price_rub', 'min_price.amount_minor', false, 'Минимальная цена руб'],
  ['is_discount_forbidden', 'is_discount_forbidden', false, 'Скидка запрещена'],
] satisfies readonly (readonly [string, string, boolean, string])[];

const ENUM_DATA = [
  ['base_unit', 'piece', ['шт', 'шт.', 'штука']],
  ['base_unit', 'gram', ['г', 'грамм']],
  ['base_unit', 'milliliter', ['мл', 'миллилитр']],
  ['marking_mode', 'none', ['нет']],
  ['marking_mode', 'unit', ['поштучная']],
  ['marking_mode', 'volume', ['объёмная', 'объемная']],
  ['vat_rate', 'none', ['без ндс']],
  ['vat_rate', '10', ['10%']],
  ['vat_rate', '22', ['22%']],
  ['is_discount_forbidden', 'true', ['да', '1']],
  ['is_discount_forbidden', 'false', ['нет', '0']],
] satisfies readonly (readonly [string, string, readonly string[]])[];

export const CATALOG_IMPORT_TEMPLATE = create(ImportTemplateSchema, {
  columns: COLUMN_DATA.map(([key, fieldPath, isRequired, alias]) => create(ImportColumnSchema, {
    aliases: [alias], fieldPath, isRequired, key, titleKey: `import.column.${key}`,
  })),
  currencyCode: 'RUB',
  enumValues: ENUM_DATA.map(([columnKey, value, aliases]) => create(ImportEnumValueSchema, { aliases: [...aliases], columnKey, value })),
  id: 'catalog',
});
