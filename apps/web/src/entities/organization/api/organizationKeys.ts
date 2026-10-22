interface OrganizationKeysValue {
  all: readonly ['organization'];
  detail: (organizationId: string) => readonly ['organization', 'detail', string];
  settings: (organizationId: string) => readonly ['organization', 'settings', string];
  spheres: () => readonly ['organization', 'spheres'];
}

export const organizationKeys: OrganizationKeysValue = {
  all: ['organization'],
  detail: organizationId => ['organization', 'detail', organizationId],
  settings: organizationId => ['organization', 'settings', organizationId],
  spheres: () => ['organization', 'spheres'],
};
