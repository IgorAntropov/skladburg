import { isPlainRecord } from './isPlainRecord';

export const areFormValuesEqual = (current: unknown, prev: unknown): boolean => {
  if (Object.is(current, prev)) {
    return true;
  }

  if (Array.isArray(current) && Array.isArray(prev)) {
    return current.length === prev.length
      && current.every((item: unknown, index) => areFormValuesEqual(item, prev[index]));
  }

  if (isPlainRecord(current) && isPlainRecord(prev)) {
    const currentKeys = Object.keys(current);

    return currentKeys.length === Object.keys(prev).length
      && currentKeys.every(key => Object.hasOwn(prev, key) && areFormValuesEqual(current[key], prev[key]));
  }

  return false;
};
