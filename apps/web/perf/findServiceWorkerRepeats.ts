import type { RequestValue } from './perfTypes.ts';

import { isDownloadedFromNetwork } from './findDuplicates.ts';

export const findServiceWorkerRepeats = (requests: readonly RequestValue[]): string[] => {
  const downloaded = requests.filter(isDownloadedFromNetwork);
  const urlsOfPageAndWorker = new Set(downloaded.filter(request => request.target !== 'service-worker').map(request => request.url));
  const urlsOfServiceWorker = new Set(downloaded.filter(request => request.target === 'service-worker').map(request => request.url));

  return [...urlsOfServiceWorker].filter(url => urlsOfPageAndWorker.has(url)).sort();
};
