import { PermissionCode } from '../gen/access/v1/permission_pb';
import { compareCodeUnits } from './compareCodeUnits';

export type KnownPermissionCode = Exclude<PermissionCode, PermissionCode.UNSPECIFIED>;

interface PermissionCodeIndexValue {
  codesByName: ReadonlyMap<string, KnownPermissionCode>;
  sortedCodes: readonly KnownPermissionCode[];
}

let permissionCodeIndex: PermissionCodeIndexValue | undefined;

const isDeclaredCode = (value: number | string): value is PermissionCode => typeof value === 'number';

const isKnownCode = (code: PermissionCode): code is KnownPermissionCode => code !== PermissionCode.UNSPECIFIED;

export const getPermissionName = (code: KnownPermissionCode): string => PermissionCode[code].toLowerCase();

const buildPermissionCodeIndex = (): PermissionCodeIndexValue => {
  const sortedCodes = Object.values(PermissionCode)
    .filter(isDeclaredCode)
    .filter(isKnownCode)
    .sort((current, next) => compareCodeUnits(getPermissionName(current), getPermissionName(next)));

  return {
    codesByName: new Map(sortedCodes.map(code => [getPermissionName(code), code])),
    sortedCodes,
  };
};

const getPermissionCodeIndex = (): PermissionCodeIndexValue => {
  permissionCodeIndex ??= buildPermissionCodeIndex();

  return permissionCodeIndex;
};

export const findPermissionCode = (name: string): KnownPermissionCode | undefined =>
  getPermissionCodeIndex().codesByName.get(name);

export const listPermissionCodes = (): KnownPermissionCode[] => [...getPermissionCodeIndex().sortedCodes];
