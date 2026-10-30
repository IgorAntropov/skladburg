import { isPlainRecord } from './isPlainRecord';

const collectLeafPaths = (record: Record<string, unknown>, prefix: string, paths: string[]): void => {
  for (const [key, value] of Object.entries(record)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;

    if (isPlainRecord(value)) {
      collectLeafPaths(value, path, paths);
    }
    else {
      paths.push(path);
    }
  }
};

export const collectFieldNames = (defaultValues: Record<string, unknown>): string[] => {
  const paths: string[] = [];

  collectLeafPaths(defaultValues, '', paths);

  return paths;
};
