const UUID_BYTE_COUNT = 16;
const VERSION_BYTE_INDEX = 6;
const VARIANT_BYTE_INDEX = 8;
const VERSION_4_MASK = 0x40;
const VERSION_CLEAR_MASK = 0x0f;
const VARIANT_MASK = 0x80;
const VARIANT_CLEAR_MASK = 0x3f;
const HEX_RADIX = 16;
const GROUP_BOUNDARIES = [4, 6, 8, 10] as const;

export type FillRandomBytesValue = (bytes: Uint8Array<ArrayBuffer>) => unknown;

const toHex = (byte: number): string => byte.toString(HEX_RADIX).padStart(2, '0');

export const formatUuidV4 = (randomBytes: Uint8Array<ArrayBuffer>): string => {
  const bytes = Uint8Array.from(randomBytes);
  bytes[VERSION_BYTE_INDEX] = ((bytes[VERSION_BYTE_INDEX] ?? 0) & VERSION_CLEAR_MASK) | VERSION_4_MASK;
  bytes[VARIANT_BYTE_INDEX] = ((bytes[VARIANT_BYTE_INDEX] ?? 0) & VARIANT_CLEAR_MASK) | VARIANT_MASK;

  return [...bytes]
    .map((byte, index) => `${GROUP_BOUNDARIES.some(boundary => boundary === index) ? '-' : ''}${toHex(byte)}`)
    .join('');
};

export const createRandomUuid = (fillRandomBytes: FillRandomBytesValue): string => {
  const bytes = new Uint8Array(UUID_BYTE_COUNT);
  fillRandomBytes(bytes);

  return formatUuidV4(bytes);
};
