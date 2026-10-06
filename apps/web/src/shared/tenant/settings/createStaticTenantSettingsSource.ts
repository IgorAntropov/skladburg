import type {
  ITenantSettingsSource,
  TenantSettingsValue,
} from './tenantSettingsTypes';

export const createStaticTenantSettingsSource = (tenants: readonly TenantSettingsValue[]): ITenantSettingsSource => {
  const tenantsById = new Map(tenants.map(tenant => [tenant.tenantId, tenant]));

  return {
    getTenantSettings: (tenantId) => {
      const tenant = tenantsById.get(tenantId);

      if (tenant === undefined) {
        return Promise.reject(new Error(`Tenant settings not found for tenantId "${tenantId}"`));
      }

      return Promise.resolve(tenant);
    },
  };
};
