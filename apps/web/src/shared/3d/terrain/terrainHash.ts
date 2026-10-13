const UNIT_DIVISOR = 4294967296;

const mixBits = (value: number): number => {
  let bits = value | 0;
  bits ^= bits >>> 16;
  bits = Math.imul(bits, 0x7feb352d);
  bits ^= bits >>> 15;
  bits = Math.imul(bits, 0x846ca68b);
  bits ^= bits >>> 16;

  return bits >>> 0;
};

export const hashCoordinates = (seed: number, x: number, y: number, salt: number): number => {
  let bits = mixBits(seed ^ Math.imul(salt, 0x9e3779b1));
  bits = mixBits(bits ^ Math.imul(x, 0x85ebca6b));
  bits = mixBits(bits ^ Math.imul(y, 0xc2b2ae35));

  return bits;
};

export const hashUnit = (seed: number, x: number, y: number, salt: number): number =>
  hashCoordinates(seed, x, y, salt) / UNIT_DIVISOR;
