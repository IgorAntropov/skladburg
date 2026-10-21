interface NetworkKeysValue {
  all: readonly ['network'];
  directory: () => readonly ['network', 'directory'];
  mapSites: (organizationScope: string) => readonly ['network', 'map-sites', string];
}

export const networkKeys: NetworkKeysValue = {
  all: ['network'],
  directory: () => ['network', 'directory'],
  mapSites: organizationScope => ['network', 'map-sites', organizationScope],
};
