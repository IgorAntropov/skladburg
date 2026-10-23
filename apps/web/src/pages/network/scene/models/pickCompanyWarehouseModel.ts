import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelEntryValue } from './worldModelCatalog';

import {
  COMPANY_WAREHOUSE_MODEL_ID,
  WORLD_MODEL_CATALOG,
} from './worldModelCatalog';

const COMPANY_WAREHOUSE_ENTRY = WORLD_MODEL_CATALOG.find(entry => entry.id === COMPANY_WAREHOUSE_MODEL_ID);

export const pickCompanyWarehouseModel = (building: Pick<NetworkSceneBuildingValue, 'kind'>): undefined | WorldModelEntryValue => (
  building.kind === 'warehouse' ? COMPANY_WAREHOUSE_ENTRY : undefined
);
