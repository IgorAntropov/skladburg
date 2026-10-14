export const createFindMissingPrecachedAssetsScript = (assetNames: readonly string[]): string => `
(async () => {
  const expectedNames = ${JSON.stringify(assetNames)};
  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration || !registration.active || registration.active.state !== 'activated') {
    return expectedNames;
  }

  const cachedPaths = [];

  for (const cacheName of await caches.keys()) {
    const cache = await caches.open(cacheName);

    for (const request of await cache.keys()) {
      cachedPaths.push(new URL(request.url).pathname);
    }
  }

  return expectedNames.filter((name) => !cachedPaths.some((path) => path.endsWith('/assets/' + name)));
})()
`;
