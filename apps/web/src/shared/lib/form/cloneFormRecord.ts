import { isPlainRecord } from './isPlainRecord';
import { isRecordList } from './isRecordList';

const cloneValue = (value: unknown): unknown => {
  if (isPlainRecord(value)) {
    return cloneFormRecord(value);
  }

  return isRecordList(value) ? value.map(cloneValue) : value;
};

export const cloneFormRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const clone: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    clone[key] = cloneValue(value);
  }

  return clone;
};
