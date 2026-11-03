import type { MapSite } from '@skladburg/contracts/network/v1/network';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';

import type {
  OwnListingsPageValue,
  ShowcasePageValue,
} from '@/entities/listing';
import type { NetworkDirectoryValue } from '@/entities/network';

import type { SearchGroupStatusValue } from './searchResultTypes';

export interface SearchSourceStatesValue {
  directory: SearchSourceStateValue<NetworkDirectoryValue> | undefined;
  mapSites: SearchSourceStateValue<readonly MapSite[]> | undefined;
  organizations: SearchSourceStateValue<readonly OrganizationShowcase[]> | undefined;
  ownListings: SearchSourceStateValue<OwnListingsPageValue> | undefined;
  showcaseListings: SearchSourceStateValue<ShowcasePageValue> | undefined;
  warehouses: SearchSourceStateValue<readonly Warehouse[]> | undefined;
}

export interface SearchSourceStateValue<TData> {
  data: TData | undefined;
  error: Error | null;
  isStale: boolean;
  retry: () => void;
  status: SearchGroupStatusValue;
}
