import { isPlainRecord } from './isPlainRecord';

const isFieldError = (node: Record<string, unknown>): boolean => typeof node.type === 'string';

const collectLeafPaths = (errors: Record<string, unknown>, prefix: string, paths: string[]): void => {
  for (const [key, node] of Object.entries(errors)) {
    if (!isPlainRecord(node)) {
      continue;
    }

    const path = prefix === '' ? key : `${prefix}.${key}`;

    if (isFieldError(node)) {
      paths.push(path);
    }
    else {
      collectLeafPaths(node, path, paths);
    }
  }
};

export const collectErrorPaths = (errors: Record<string, unknown>): string[] => {
  const paths: string[] = [];

  collectLeafPaths(errors, '', paths);

  return paths;
};
