import type { EngineSeedValue } from './seedConfig';

import { createSeedSnapshot as createBaseSnapshot } from './seedSnapshot';
import { addSeedWarehouseEquipment } from './seedWarehouseEquipment';
import { addStaffAccounts } from './seedWarehouseStaffAccess';

export { createSeedRoleId } from './seedAccess';
export {
  SeedCityId,
  SeedMapNodeId,
  SeedMembershipId,
  SeedOrganizationId,
  SeedPersonaId,
  SeedRoleId,
  SeedRouteLegId,
  SeedSphereId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
export {
  createSeedNotifications,
  SeedNotificationId,
} from './seedNotifications';
export { SEED_DEFAULT_LOCALE } from './seedOrganizations';
export {
  PLATFORM_OPERATOR_NAME,
  SEED_OPERATOR_ROLE_IDS,
  SEED_OPERATOR_STAFF_DEFINITIONS,
} from './seedPlatform';
export {
  createSeedRecords,
  DEFAULT_ENGINE_SEED,
  type EngineSeedValue,
  SEED_RANDOM_SEED,
  SEED_TIME_SCALE,
  SEED_VERSION,
  SEED_WORLD_START_MS,
  type SeedRecordsValue,
} from './seedSnapshot';

export const createSeedSnapshot = (seed?: EngineSeedValue): ReturnType<typeof createBaseSnapshot> =>
  addSeedWarehouseEquipment(addStaffAccounts(createBaseSnapshot(seed)), undefined);
