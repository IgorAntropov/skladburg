import type { EngineSnapshotValue } from '../ports/index';

import {
  createPresetRole,
  listPresetsForProfiles,
} from '../access/rolePresets';
import { createSeedRoleId } from '../seed/seedIds';
import { addStaffAccounts } from '../seed/seedWarehouseStaffAccess';
import { TABLE_DEFINITIONS } from '../state/index';

const STAFF_PERMISSIONS = new Set(['staff_performance_view', 'staff_profile_view', 'staff_qualification_view']);

export const addWarehouseStaff = (snapshot: EngineSnapshotValue): EngineSnapshotValue => {
  const { collections } = snapshot;
  const roles = new Map(collections.roles);
  for (const stored of collections.roles.values()) {
    const role = TABLE_DEFINITIONS.roles.decode(stored);
    const owner = collections.organizations.get(role.tenantId);
    if (owner === undefined) {
      continue;
    }
    const organization = TABLE_DEFINITIONS.organizations.decode(owner);
    const match = listPresetsForProfiles(organization.profiles.map(profile => profile.kind))
      .find(preset => preset.key === role.presetKey && createSeedRoleId(organization.id, preset.key) === role.id);
    if (match === undefined) {
      continue;
    }
    const preset = createPresetRole(match, organization, role.id);
    const baseline = preset.permissions.filter(permission => !STAFF_PERMISSIONS.has(permission));
    if (role.tenantId === preset.tenantId && role.presetKey === preset.presetKey && role.permissions.length === baseline.length
      && baseline.every(permission => role.permissions.includes(permission)) && baseline.length < preset.permissions.length) {
      role.permissions = [...preset.permissions];
      roles.set(role.id, TABLE_DEFINITIONS.roles.encode(role));
    }
  }

  return addStaffAccounts({ ...snapshot, collections: { ...collections, roles } });
};
