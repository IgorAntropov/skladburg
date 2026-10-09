const FNV_OFFSET_BASIS = 0x811C9DC5;
const FNV_PRIME = 0x01000193;

const textEncoder = new TextEncoder();

export const hashFnv1a32 = (text: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (const byte of textEncoder.encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash >>> 0;
};
