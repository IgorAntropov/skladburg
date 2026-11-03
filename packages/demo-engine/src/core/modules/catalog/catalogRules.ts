import type {
  BaseUnit,
  OwnDeliveryTerms,
  Packaging,
  PriceTier,
  TemperatureRange,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import type { ViolationValue } from '../../errors/index';

export const SUPPORTED_CURRENCY_CODE = 'RUB';

export const CURRENCY_UNSUPPORTED_RULE_ID = 'money.currency_unsupported';
export const SKU_TAKEN_RULE_ID = 'catalog.sku_taken';
export const GTIN_TAKEN_RULE_ID = 'catalog.gtin_taken';
export const PACKAGING_ID_DUPLICATE_RULE_ID = 'catalog.packaging_id_duplicate';
export const TEMPERATURE_RANGE_ORDER_RULE_ID = 'catalog.temperature_range_order';
export const MIN_PRICE_ABOVE_TIER_RULE_ID = 'catalog.min_price_above_tier';
export const LISTING_PRODUCT_TAKEN_RULE_ID = 'catalog.listing_product_taken';
export const SPHERE_EXISTS_RULE_ID = 'catalog.sphere_exists';
export const WAREHOUSE_EXISTS_RULE_ID = 'catalog.warehouse_exists';
export const WAREHOUSE_DUPLICATE_RULE_ID = 'catalog.warehouse_duplicate';
export const AVAILABILITY_QUANTITY_REQUIRED_RULE_ID = 'catalog.availability_quantity_required';
export const MIN_ORDER_NOT_MULTIPLE_OF_STEP_RULE_ID = 'catalog.min_order_not_multiple_of_step';
export const LISTING_WAREHOUSE_REQUIRED_RULE_ID = 'catalog.listing_warehouse_required';
export const LISTING_PRICE_REQUIRED_RULE_ID = 'catalog.listing_price_required';
export const TIER_ORDER_RULE_ID = 'catalog.tier_order';
export const TIER_PRICE_ORDER_RULE_ID = 'catalog.tier_price_order';
export const TIER_ABOVE_MINIMUM_ORDER_RULE_ID = 'catalog.tier_above_minimum_order';
export const PRICE_BELOW_MINIMUM_RULE_ID = 'catalog.price_below_minimum';
export const PRICE_UNIT_LOCKED_RULE_ID = 'catalog.price_unit_locked';
export const LISTING_PRODUCT_LOCKED_RULE_ID = 'catalog.listing_product_locked';
export const BASE_UNIT_LOCKED_RULE_ID = 'catalog.base_unit_locked';
export const QUANTITY_BELOW_MINIMUM_RULE_ID = 'catalog.quantity_below_minimum';
export const QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID = 'catalog.quantity_not_multiple_of_step';
export const QUANTITY_ABOVE_LIMIT_RULE_ID = 'catalog.quantity_above_limit';
export const AMOUNT_ABOVE_LIMIT_RULE_ID = 'catalog.amount_above_limit';

export const MAX_CATALOG_QUANTITY = 10_000_000_000n;
export const MAX_CATALOG_AMOUNT_MINOR = 500_000_000n;

export interface ListingPriceRulesInputValue {
  minOrderQuantity: bigint;
  productMinPrice: Money | undefined;
  tiers: readonly PriceTier[];
}

export interface ListingRulesInputValue {
  availability: readonly WarehouseAvailability[];
  baseQuantity: bigint;
  existingFirstTierMinQuantity: bigint | undefined;
  isProductTaken: boolean;
  isPublished: boolean;
  knownSphereIds: ReadonlySet<string>;
  minOrderQuantity: bigint;
  orderStep: bigint;
  ownWarehouseIds: ReadonlySet<string>;
  priceLock: PriceLockValue | undefined;
  productId: string;
  sphereIds: readonly string[];
}

export interface PriceLockValue {
  baseQuantity: bigint;
  productId: string;
}

export interface ProductRulesInputValue {
  baseUnit: BaseUnit;
  baseUnitLock: BaseUnit | undefined;
  gtin: string;
  minPrice: Money | undefined;
  packagings: readonly Packaging[];
  sku: string;
  storageTemperature: TemperatureRange | undefined;
  takenGtins: ReadonlySet<string>;
  takenSkus: ReadonlySet<string>;
  tierAmounts: readonly bigint[];
}

export interface PublicationRulesInputValue {
  availabilityCount: number;
  hasPrice: boolean;
}

const indexedPath = (collection: string, index: number, field: string): string => `${collection}[${String(index)}].${field}`;

export const collectTierAmounts = (tiers: readonly PriceTier[]): bigint[] =>
  tiers.flatMap(tier => (tier.price === undefined ? [] : [tier.price.amountMinor]));

const collectCurrencyViolations = (money: Money | undefined, fieldPath: string): ViolationValue[] =>
  money !== undefined && money.currencyCode !== SUPPORTED_CURRENCY_CODE
    ? [{ fieldPath, ruleId: CURRENCY_UNSUPPORTED_RULE_ID }]
    : [];

const isTierPriceNotLower = (tier: PriceTier, previous: PriceTier | undefined): boolean => {
  const price = tier.price;
  const previousPrice = previous?.price;

  if (previous === undefined || price === undefined || previousPrice === undefined) {
    return false;
  }

  const isRouble = price.currencyCode === SUPPORTED_CURRENCY_CODE && previousPrice.currencyCode === SUPPORTED_CURRENCY_CODE;

  return isRouble && tier.minQuantity > previous.minQuantity && price.amountMinor >= previousPrice.amountMinor;
};

const collectLimitViolations = (value: bigint, limit: bigint, fieldPath: string, ruleId: string): ViolationValue[] =>
  value > limit ? [{ fieldPath, ruleId }] : [];

export const collectQuantityLimitViolations = (quantity: bigint, fieldPath: string): ViolationValue[] =>
  collectLimitViolations(quantity, MAX_CATALOG_QUANTITY, fieldPath, QUANTITY_ABOVE_LIMIT_RULE_ID);

const collectAmountLimitViolations = (money: Money | undefined, fieldPath: string): ViolationValue[] =>
  money === undefined ? [] : collectLimitViolations(money.amountMinor, MAX_CATALOG_AMOUNT_MINOR, fieldPath, AMOUNT_ABOVE_LIMIT_RULE_ID);

const collectDuplicatePackagingViolations = (packagings: readonly Packaging[]): ViolationValue[] => {
  const seenIds = new Set<string>();
  const violations: ViolationValue[] = [];

  packagings.forEach((packaging, index) => {
    if (seenIds.has(packaging.id)) {
      violations.push({ fieldPath: indexedPath('packagings', index, 'id'), ruleId: PACKAGING_ID_DUPLICATE_RULE_ID });
    }

    seenIds.add(packaging.id);
  });

  return violations;
};

export const collectProductViolations = (input: ProductRulesInputValue): ViolationValue[] => {
  const violations: ViolationValue[] = [];
  const { baseUnitLock, minPrice, storageTemperature } = input;

  if (baseUnitLock !== undefined && baseUnitLock !== input.baseUnit) {
    violations.push({ fieldPath: 'base_unit', ruleId: BASE_UNIT_LOCKED_RULE_ID });
  }

  if (input.takenSkus.has(input.sku)) {
    violations.push({ fieldPath: 'sku', ruleId: SKU_TAKEN_RULE_ID });
  }

  if (input.gtin !== '' && input.takenGtins.has(input.gtin)) {
    violations.push({ fieldPath: 'gtin', ruleId: GTIN_TAKEN_RULE_ID });
  }

  violations.push(...collectDuplicatePackagingViolations(input.packagings));

  if (storageTemperature !== undefined && storageTemperature.minCelsius > storageTemperature.maxCelsius) {
    violations.push({ fieldPath: 'storage_temperature.max_celsius', ruleId: TEMPERATURE_RANGE_ORDER_RULE_ID });
  }

  violations.push(...collectCurrencyViolations(minPrice, 'min_price.currency_code'));
  violations.push(...collectAmountLimitViolations(minPrice, 'min_price.amount_minor'));

  if (minPrice !== undefined && input.tierAmounts.some(amount => amount < minPrice.amountMinor)) {
    violations.push({ fieldPath: 'min_price.amount_minor', ruleId: MIN_PRICE_ABOVE_TIER_RULE_ID });
  }

  return violations;
};

const collectAvailabilityViolations = (input: ListingRulesInputValue): ViolationValue[] => {
  const seenWarehouseIds = new Set<string>();
  const violations: ViolationValue[] = [];

  input.availability.forEach((entry, index) => {
    const warehousePath = indexedPath('availability', index, 'warehouse_id');
    const isQuantityRequired = entry.status === AvailabilityStatus.IN_STOCK || entry.status === AvailabilityStatus.LOW;

    if (!input.ownWarehouseIds.has(entry.warehouseId)) {
      violations.push({ fieldPath: warehousePath, ruleId: WAREHOUSE_EXISTS_RULE_ID });
    }
    else if (seenWarehouseIds.has(entry.warehouseId)) {
      violations.push({ fieldPath: warehousePath, ruleId: WAREHOUSE_DUPLICATE_RULE_ID });
    }

    seenWarehouseIds.add(entry.warehouseId);

    const quantityPath = indexedPath('availability', index, 'quantity');

    if (isQuantityRequired && entry.quantity === 0n) {
      violations.push({ fieldPath: quantityPath, ruleId: AVAILABILITY_QUANTITY_REQUIRED_RULE_ID });
    }

    violations.push(...collectQuantityLimitViolations(entry.quantity, quantityPath));
  });

  return violations;
};

export const collectListingViolations = (input: ListingRulesInputValue): ViolationValue[] => {
  const violations: ViolationValue[] = [];

  if (input.isProductTaken) {
    violations.push({ fieldPath: 'product_id', ruleId: LISTING_PRODUCT_TAKEN_RULE_ID });
  }

  const { priceLock } = input;

  if (priceLock !== undefined && priceLock.productId !== input.productId) {
    violations.push({ fieldPath: 'product_id', ruleId: LISTING_PRODUCT_LOCKED_RULE_ID });
  }

  if (priceLock !== undefined && priceLock.baseQuantity !== input.baseQuantity) {
    violations.push({ fieldPath: 'price_unit.base_quantity', ruleId: PRICE_UNIT_LOCKED_RULE_ID });
  }

  input.sphereIds.forEach((sphereId, index) => {
    if (!input.knownSphereIds.has(sphereId)) {
      violations.push({ fieldPath: `sphere_ids[${String(index)}]`, ruleId: SPHERE_EXISTS_RULE_ID });
    }
  });

  violations.push(...collectAvailabilityViolations(input));
  violations.push(...collectQuantityLimitViolations(input.minOrderQuantity, 'min_order_quantity'));
  violations.push(...collectQuantityLimitViolations(input.orderStep, 'order_step'));

  if (input.orderStep > 0n && input.minOrderQuantity % input.orderStep !== 0n) {
    violations.push({ fieldPath: 'min_order_quantity', ruleId: MIN_ORDER_NOT_MULTIPLE_OF_STEP_RULE_ID });
  }

  if (input.isPublished && input.availability.length === 0) {
    violations.push({ fieldPath: 'availability', ruleId: LISTING_WAREHOUSE_REQUIRED_RULE_ID });
  }

  const { existingFirstTierMinQuantity } = input;

  if (existingFirstTierMinQuantity !== undefined && existingFirstTierMinQuantity > input.minOrderQuantity) {
    violations.push({ fieldPath: 'min_order_quantity', ruleId: TIER_ABOVE_MINIMUM_ORDER_RULE_ID });
  }

  return violations;
};

export const collectPublicationViolations = (input: PublicationRulesInputValue): ViolationValue[] => {
  const violations: ViolationValue[] = [];

  if (input.availabilityCount === 0) {
    violations.push({ fieldPath: 'is_published', ruleId: LISTING_WAREHOUSE_REQUIRED_RULE_ID });
  }

  if (!input.hasPrice) {
    violations.push({ fieldPath: 'is_published', ruleId: LISTING_PRICE_REQUIRED_RULE_ID });
  }

  return violations;
};

export const collectListingPriceViolations = (input: ListingPriceRulesInputValue): ViolationValue[] => {
  const violations: ViolationValue[] = [];
  const { minOrderQuantity, productMinPrice, tiers } = input;

  tiers.forEach((tier, index) => {
    violations.push(...collectCurrencyViolations(tier.price, indexedPath('tiers', index, 'price.currency_code')));
    violations.push(...collectQuantityLimitViolations(tier.minQuantity, indexedPath('tiers', index, 'min_quantity')));
    violations.push(...collectAmountLimitViolations(tier.price, indexedPath('tiers', index, 'price.amount_minor')));

    const previous = tiers[index - 1];

    if (previous !== undefined && tier.minQuantity <= previous.minQuantity) {
      violations.push({ fieldPath: indexedPath('tiers', index, 'min_quantity'), ruleId: TIER_ORDER_RULE_ID });
    }

    if (isTierPriceNotLower(tier, previous)) {
      violations.push({ fieldPath: indexedPath('tiers', index, 'price.amount_minor'), ruleId: TIER_PRICE_ORDER_RULE_ID });
    }

    if (productMinPrice !== undefined && tier.price !== undefined && tier.price.amountMinor < productMinPrice.amountMinor) {
      violations.push({ fieldPath: indexedPath('tiers', index, 'price.amount_minor'), ruleId: PRICE_BELOW_MINIMUM_RULE_ID });
    }
  });

  const [firstTier] = tiers;

  if (firstTier !== undefined && firstTier.minQuantity > minOrderQuantity) {
    violations.push({ fieldPath: 'tiers[0].min_quantity', ruleId: TIER_ABOVE_MINIMUM_ORDER_RULE_ID });
  }

  return violations;
};

export const collectSalesTermsViolations = (ownDelivery: OwnDeliveryTerms | undefined): ViolationValue[] => [
  ...collectCurrencyViolations(ownDelivery?.pricePerKm, 'own_delivery.price_per_km.currency_code'),
  ...collectCurrencyViolations(ownDelivery?.minimumCharge, 'own_delivery.minimum_charge.currency_code'),
  ...collectAmountLimitViolations(ownDelivery?.pricePerKm, 'own_delivery.price_per_km.amount_minor'),
  ...collectAmountLimitViolations(ownDelivery?.minimumCharge, 'own_delivery.minimum_charge.amount_minor'),
];
