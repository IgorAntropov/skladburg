import { isPlainRecord } from './isPlainRecord';

const cloneValue = (value: unknown): unknown => (isPlainRecord(value) ? cloneFormRecord(value) : value);

export const cloneFormRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const clone: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    clone[key] = cloneValue(value);
  }

  return clone;
};
