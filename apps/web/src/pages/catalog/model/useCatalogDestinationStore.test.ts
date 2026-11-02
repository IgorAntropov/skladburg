import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useCatalogDestinationStore } from './useCatalogDestinationStore';

describe('useCatalogDestinationStore', () => {
  beforeEach(() => {
    useCatalogDestinationStore.setState({ warehouseIdByOrganization: {} });
  });

  it('remembers the warehouse for each organization apart', () => {
    const { selectWarehouse } = useCatalogDestinationStore.getState();

    selectWarehouse('org-1', 'warehouse-a');
    selectWarehouse('org-2', 'warehouse-b');
    selectWarehouse('org-1', 'warehouse-c');

    expect(useCatalogDestinationStore.getState().warehouseIdByOrganization).toEqual({
      'org-1': 'warehouse-c',
      'org-2': 'warehouse-b',
    });
  });

  it('keeps the same state object when the warehouse is already selected', () => {
    const { selectWarehouse } = useCatalogDestinationStore.getState();

    selectWarehouse('org-1', 'warehouse-a');

    const before = useCatalogDestinationStore.getState();

    selectWarehouse('org-1', 'warehouse-a');

    expect(useCatalogDestinationStore.getState()).toBe(before);
  });
});
