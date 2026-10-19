import { PermissionAction } from '@skladburg/contracts/access/v1/access';

const PERMISSION_NAME_SEPARATOR = '_';

const ACTION_BY_NAME: ReadonlyMap<string, PermissionAction> = new Map(
  Object.values(PermissionAction)
    .filter((value): value is PermissionAction => typeof value === 'number' && value !== PermissionAction.UNSPECIFIED)
    .map(action => [PermissionAction[action].toLowerCase(), action]),
);

export interface PermissionPartsValue {
  action: PermissionAction;
  feature: string;
}

export const splitPermissionName = (name: string): PermissionPartsValue => {
  const separatorIndex = name.lastIndexOf(PERMISSION_NAME_SEPARATOR);

  return {
    action: ACTION_BY_NAME.get(name.slice(separatorIndex + 1)) ?? PermissionAction.UNSPECIFIED,
    feature: name.slice(0, separatorIndex),
  };
};
