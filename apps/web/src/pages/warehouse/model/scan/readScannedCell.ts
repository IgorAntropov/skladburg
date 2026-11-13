import { AIM_PREFIX } from './parseWarehouseScan';

export const readScannedCell = (raw: string, cells: ReadonlyMap<string, string>): string | undefined => {
  const address = raw.trim().replace(AIM_PREFIX, '').toUpperCase();
  for (const [id, code] of cells) {
    if (code === address) {
      return id;
    }
  }
  return undefined;
};
