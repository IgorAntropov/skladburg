import type { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IDomainErrors } from '../../errors/index';

export interface OwnedVersionedRecordValue {
  tenantId: string;
  version: bigint;
}

export const assertExpectedVersion = (
  errors: IDomainErrors,
  entity: EntityKind,
  current: undefined | { version: bigint },
  expectedVersion: bigint,
): void => {
  if (current === undefined) {
    if (expectedVersion > 0n) {
      throw errors.notFound(entity);
    }

    return;
  }

  if (current.version !== expectedVersion) {
    throw errors.versionConflict(entity, Number(current.version));
  }
};

export const assertVersionOrInitial = (
  errors: IDomainErrors,
  entity: EntityKind,
  currentVersion: bigint,
  expectedVersion: bigint,
): void => {
  if (currentVersion !== expectedVersion) {
    throw errors.versionConflict(entity, Number(currentVersion));
  }
};

export const readOwnedForSave = <TRecord extends OwnedVersionedRecordValue>(
  errors: IDomainErrors,
  entity: EntityKind,
  current: TRecord | undefined,
  organizationId: string,
  expectedVersion: bigint,
): TRecord | undefined => {
  if (current !== undefined && current.tenantId !== organizationId) {
    throw errors.notFound(entity);
  }

  assertExpectedVersion(errors, entity, current, expectedVersion);

  return current;
};

export const readOwned = <TRecord extends { tenantId: string }>(
  errors: IDomainErrors,
  entity: EntityKind,
  record: TRecord | undefined,
  organizationId: string,
): TRecord => {
  if (record?.tenantId !== organizationId) {
    throw errors.notFound(entity);
  }

  return record;
};
