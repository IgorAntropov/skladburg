import type { ReadResult } from 'zxing-wasm/reader';

const GS1_AIM = /^\](?:C1|d2|Q3)$/u;
const REARM_AFTER_MS = 750;
const MAX_SCAN_LENGTH = 256;

export const toCameraScan = ({ isValid, symbologyIdentifier, text }: Pick<ReadResult, 'isValid' | 'symbologyIdentifier' | 'text'>):
  string | undefined => {
  if (!isValid || text.trim() === '' || text.length > MAX_SCAN_LENGTH) {
    return undefined;
  }
  return GS1_AIM.test(symbologyIdentifier) ? symbologyIdentifier + text : text;
};

export const createCameraCodeGate = (): ((codes: readonly string[], now: number) => string[]) => {
  const lastSeen = new Map<string, number>();
  let previous: readonly string[] = [];

  return (codes, now) => {
    for (const [code, time] of lastSeen) {
      if (now - time >= REARM_AFTER_MS && !previous.includes(code)) {
        lastSeen.delete(code);
      }
    }

    const fresh: string[] = [];
    for (const code of codes) {
      if (!lastSeen.has(code)) {
        fresh.push(code);
      }
      lastSeen.set(code, now);
    }
    previous = codes;
    return fresh;
  };
};
