export const COMMISSION_RATE_BASIS_POINTS = 150;

export const calculateCommissionMinor = (amountMinor: bigint): bigint =>
  (amountMinor * BigInt(COMMISSION_RATE_BASIS_POINTS) + 5_000n) / 10_000n;
