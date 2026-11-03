import type {
  CatalogEditorMessageKeyValue,
  CatalogEditorTranslate,
} from '../i18n/editor/editorSection';

type ViolationKeyValue = Extract<CatalogEditorMessageKeyValue, `catalogEditor.validation.${string}`>;

const VIOLATION_KEYS: ReadonlyMap<string, ViolationKeyValue> = new Map<string, ViolationKeyValue>([
  ['calendar_date.exists', 'catalogEditor.validation.calendar_date.exists'],
  ['catalog.amount_above_limit', 'catalogEditor.validation.catalog.amount_above_limit'],
  ['catalog.availability_quantity_required', 'catalogEditor.validation.catalog.availability_quantity_required'],
  ['catalog.base_unit_locked', 'catalogEditor.validation.catalog.base_unit_locked'],
  ['catalog.gtin_taken', 'catalogEditor.validation.catalog.gtin_taken'],
  ['catalog.listing_price_required', 'catalogEditor.validation.catalog.listing_price_required'],
  ['catalog.listing_product_locked', 'catalogEditor.validation.catalog.listing_product_locked'],
  ['catalog.listing_product_taken', 'catalogEditor.validation.catalog.listing_product_taken'],
  ['catalog.listing_warehouse_required', 'catalogEditor.validation.catalog.listing_warehouse_required'],
  ['catalog.min_order_not_multiple_of_step', 'catalogEditor.validation.catalog.min_order_not_multiple_of_step'],
  ['catalog.min_price_above_tier', 'catalogEditor.validation.catalog.min_price_above_tier'],
  ['catalog.packaging_id_duplicate', 'catalogEditor.validation.catalog.packaging_id_duplicate'],
  ['catalog.price_below_minimum', 'catalogEditor.validation.catalog.price_below_minimum'],
  ['catalog.price_unit_locked', 'catalogEditor.validation.catalog.price_unit_locked'],
  ['catalog.quantity_above_limit', 'catalogEditor.validation.catalog.quantity_above_limit'],
  ['catalog.quantity_below_minimum', 'catalogEditor.validation.catalog.quantity_below_minimum'],
  ['catalog.quantity_not_multiple_of_step', 'catalogEditor.validation.catalog.quantity_not_multiple_of_step'],
  ['catalog.sku_taken', 'catalogEditor.validation.catalog.sku_taken'],
  ['catalog.sphere_exists', 'catalogEditor.validation.catalog.sphere_exists'],
  ['catalog.temperature_range_order', 'catalogEditor.validation.catalog.temperature_range_order'],
  ['catalog.tier_above_minimum_order', 'catalogEditor.validation.catalog.tier_above_minimum_order'],
  ['catalog.tier_order', 'catalogEditor.validation.catalog.tier_order'],
  ['catalog.tier_price_order', 'catalogEditor.validation.catalog.tier_price_order'],
  ['catalog.warehouse_duplicate', 'catalogEditor.validation.catalog.warehouse_duplicate'],
  ['catalog.warehouse_exists', 'catalogEditor.validation.catalog.warehouse_exists'],
  ['field_check.gtin', 'catalogEditor.validation.field_check.gtin'],
  ['int32.gte_lte', 'catalogEditor.validation.int32.gte_lte'],
  ['int64.gt', 'catalogEditor.validation.int64.gt'],
  ['int64.gte', 'catalogEditor.validation.int64.gte'],
  ['money.currency_unsupported', 'catalogEditor.validation.money.currency_unsupported'],
]);

export const translateCatalogViolation = (t: CatalogEditorTranslate, ruleId: string): string | undefined => {
  const key = VIOLATION_KEYS.get(ruleId);

  return key === undefined ? undefined : t(key);
};
