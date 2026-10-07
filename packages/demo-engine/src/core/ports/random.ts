export interface IRandom {
  getState: () => RandomStateValue;
  next: () => number;
  nextInt: (maxExclusive: number) => number;
  uuid: () => string;
}

export interface RandomStateValue {
  a: number;
  b: number;
  c: number;
  d: number;
}

const UINT32_RANGE = 4294967296;
const WARM_UP_ROUNDS = 12;
const UUID_BYTE_COUNT = 16;
const UUID_VERSION_BYTE_INDEX = 6;
const UUID_VARIANT_BYTE_INDEX = 8;
const UUID_DASH_POSITIONS: ReadonlySet<number> = new Set([4, 6, 8, 10]);

const toUint32 = (value: number): number => value >>> 0;

const createSeedMixer = (seed: number): (() => number) => {
  let counter = toUint32(seed);

  return (): number => {
    counter = toUint32(counter + 0x9e3779b9);
    let mixed = counter;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
    mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);

    return toUint32(mixed ^ (mixed >>> 16));
  };
};

const assertValidState = (state: RandomStateValue): void => {
  const isValid = [state.a, state.b, state.c, state.d].every(part => Number.isInteger(part) && part >= 0 && part < UINT32_RANGE);

  if (!isValid) {
    throw new RangeError('Random state must consist of four unsigned 32-bit integers');
  }
};

export const createRandom = (initial: RandomStateValue): IRandom => {
  assertValidState(initial);

  let a = initial.a;
  let b = initial.b;
  let c = initial.c;
  let d = initial.d;

  const nextUint32 = (): number => {
    const result = toUint32(toUint32(a + b) + d);
    d = toUint32(d + 1);
    a = toUint32(b ^ (b >>> 9));
    b = toUint32(c + (c << 3));
    c = toUint32((c << 21) | (c >>> 11));
    c = toUint32(c + result);

    return result;
  };

  const next = (): number => nextUint32() / UINT32_RANGE;

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
      throw new RangeError(`Upper bound must be an integer between 1 and ${String(UINT32_RANGE)}, got ${String(maxExclusive)}`);
    }

    const acceptedRange = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    let candidate = nextUint32();

    while (candidate >= acceptedRange) {
      candidate = nextUint32();
    }

    return candidate % maxExclusive;
  };

  const uuid = (): string => {
    const bytes: number[] = [];

    while (bytes.length < UUID_BYTE_COUNT) {
      const word = nextUint32();
      bytes.push(word >>> 24, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
    }

    bytes[UUID_VERSION_BYTE_INDEX] = ((bytes[UUID_VERSION_BYTE_INDEX] ?? 0) & 0x0f) | 0x40;
    bytes[UUID_VARIANT_BYTE_INDEX] = ((bytes[UUID_VARIANT_BYTE_INDEX] ?? 0) & 0x3f) | 0x80;

    return bytes
      .map((byte, index) => `${UUID_DASH_POSITIONS.has(index) ? '-' : ''}${byte.toString(16).padStart(2, '0')}`)
      .join('');
  };

  const getState = (): RandomStateValue => ({ a, b, c, d });

  return { getState, next, nextInt, uuid };
};

export const createSeededRandom = (seed: number): IRandom => {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`Seed must be an integer, got ${String(seed)}`);
  }

  const mix = createSeedMixer(seed);
  const random = createRandom({ a: mix(), b: mix(), c: mix(), d: mix() });

  for (let round = 0; round < WARM_UP_ROUNDS; round += 1) {
    random.next();
  }

  return random;
};
