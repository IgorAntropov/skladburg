import { splitPathAndQuery } from '../address/splitPathAndQuery';

export const toPathOnly = (raw: string): string => {
  const { path } = splitPathAndQuery(raw);

  return path === '' ? '/' : path;
};

export const isSamePath = (first: string, second: string): boolean => toPathOnly(first) === toPathOnly(second);
