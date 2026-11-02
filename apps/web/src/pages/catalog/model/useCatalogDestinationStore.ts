import { create } from 'zustand';

interface CatalogDestinationStoreValue {
  selectWarehouse: (organizationId: string, warehouseId: string) => void;
  warehouseIdByOrganization: Readonly<Record<string, string>>;
}

export const useCatalogDestinationStore = create<CatalogDestinationStoreValue>()(set => ({
  selectWarehouse: (organizationId, warehouseId) => {
    set(current => (current.warehouseIdByOrganization[organizationId] === warehouseId
      ? current
      : { warehouseIdByOrganization: { ...current.warehouseIdByOrganization, [organizationId]: warehouseId } }));
  },
  warehouseIdByOrganization: {},
}));
