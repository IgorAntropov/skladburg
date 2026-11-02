import type {
  PriceList,
  SalesTerms,
} from '@skladburg/contracts/catalog/v1/catalog';
import type {
  Organization,
  Warehouse,
} from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../../../state/index';

import {
  findPriceList,
  readSalesTerms,
} from '../catalogRecords';

export interface ISupplierRecords {
  getOrganization: (organizationId: string) => Organization | undefined;
  getPriceList: (organizationId: string) => PriceList | undefined;
  getSalesTerms: (organizationId: string) => SalesTerms;
  getWarehouses: (organizationId: string) => ReadonlyMap<string, Warehouse>;
}

const memoize = <TValue>(load: (key: string) => TValue): ((key: string) => TValue) => {
  const cache = new Map<string, TValue>();

  return (key) => {
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const loaded = load(key);
    cache.set(key, loaded);

    return loaded;
  };
};

export const createSupplierRecords = (reader: IStateReader): ISupplierRecords => ({
  getOrganization: memoize(organizationId => reader.get('organizations', organizationId)),
  getPriceList: memoize(organizationId => findPriceList(reader, organizationId)),
  getSalesTerms: memoize(organizationId => readSalesTerms(reader, organizationId)),
  getWarehouses: memoize(organizationId =>
    new Map(reader.listBy('warehouses', 'tenantId', organizationId).map(warehouse => [warehouse.id, warehouse]))),
});
