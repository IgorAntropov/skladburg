interface OrganizationKeysValue {
  all: readonly ['organization'];
  detail: (organizationId: string) => readonly ['organization', 'detail', string];
  settings: (organizationId: string) => readonly ['organization', 'settings', string];
}

export const organizationKeys: OrganizationKeysValue = {
  all: ['organization'],
  detail: organizationId => ['organization', 'detail', organizationId],
  settings: organizationId => ['organization', 'settings', organizationId],
};
