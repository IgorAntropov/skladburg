import { isPlainRecord } from './isPlainRecord';

export const isRecordList = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.some(isPlainRecord);
