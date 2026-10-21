const UNIT_DIVISOR = 4294967296;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SALT_MULTIPLIER = 0x9e3779b1;

const mixBits = (value: number): number => {
  let bits = value | 0;
  bits ^= bits >>> 16;
  bits = Math.imul(bits, 0x7feb352d);
  bits ^= bits >>> 15;
  bits = Math.imul(bits, 0x846ca68b);
  bits ^= bits >>> 16;

  return bits >>> 0;
};

export const hashText = (text: string): number => {
  let bits = FNV_OFFSET;

  for (let index = 0; index < text.length; index += 1) {
    bits ^= text.charCodeAt(index);
    bits = Math.imul(bits, FNV_PRIME);
  }

  return bits >>> 0;
};

export const hashKey = (seed: number, key: string, salt: number): number =>
  mixBits(hashText(key) ^ mixBits(seed ^ Math.imul(salt + 1, SALT_MULTIPLIER)));

export const hashUnit = (seed: number, key: string, salt: number): number => hashKey(seed, key, salt) / UNIT_DIVISOR;

export const hashIndex = (seed: number, key: string, salt: number, size: number): number =>
  Math.min(size - 1, Math.floor(hashUnit(seed, key, salt) * size));

export const lerpRange = (range: readonly [number, number], unit: number): number => range[0] + (range[1] - range[0]) * unit;

export const compareIds = (current: string, prev: string): number => {
  if (current < prev) {
    return -1;
  }

  return current > prev ? 1 : 0;
};
