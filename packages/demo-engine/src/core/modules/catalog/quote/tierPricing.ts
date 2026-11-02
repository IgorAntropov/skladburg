import type {
  OwnDeliveryTerms,
  PriceTier,
} from '@skladburg/contracts/catalog/v1/catalog';

export const resolveTier = (tiers: readonly PriceTier[], quantity: bigint): PriceTier | undefined => {
  let resolved: PriceTier | undefined;

  for (const tier of tiers) {
    const isReached = tier.minQuantity <= quantity;
    const isBetterThanResolved = resolved === undefined || tier.minQuantity > resolved.minQuantity;

    if (isReached && isBetterThanResolved) {
      resolved = tier;
    }
  }

  return resolved;
};

export const computeGoodsTotal = (quantity: bigint, unitPriceMinor: bigint, priceUnitBaseQuantity: bigint): bigint =>
  (2n * quantity * unitPriceMinor + priceUnitBaseQuantity) / (2n * priceUnitBaseQuantity);

export const computeDeliveryPrice = (ownDelivery: OwnDeliveryTerms | undefined, distanceKm: number): bigint => {
  if (ownDelivery === undefined) {
    return 0n;
  }

  const minimumCharge = ownDelivery.minimumCharge?.amountMinor ?? 0n;
  const distanceCharge = (ownDelivery.pricePerKm?.amountMinor ?? 0n) * BigInt(distanceKm);

  return distanceCharge > minimumCharge ? distanceCharge : minimumCharge;
};
