import type { RequestValue } from './perfTypes.ts';

export const isDownloadedFromNetwork = (request: RequestValue): boolean => !request.fromCache && request.bytes > 0;

export const findDuplicates = (requests: readonly RequestValue[]): string[] => {
  const downloadCounts = new Map<string, number>();

  for (const request of requests) {
    if (isDownloadedFromNetwork(request)) {
      downloadCounts.set(request.url, (downloadCounts.get(request.url) ?? 0) + 1);
    }
  }

  return [...downloadCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url)
    .sort();
};
