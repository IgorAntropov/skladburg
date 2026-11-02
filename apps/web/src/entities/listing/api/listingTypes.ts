import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';

import type { PageValue } from '@/shared/api';

export interface ShowcaseListParamsValue {
  query: string;
  sphereId: string;
  toWarehouseId: string;
}

export type ShowcasePageValue = PageValue<ShowcaseListing>;
