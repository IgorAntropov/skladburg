import { PermissionCode } from '../gen/access/v1/permission_pb';
import { compareCodeUnits } from './compareCodeUnits';

export type KnownPermissionCode = Exclude<PermissionCode, PermissionCode.UNSPECIFIED>;

export type PermissionNameValue = Lowercase<Exclude<keyof typeof PermissionCode, 'UNSPECIFIED'>>;

interface PermissionCodeIndexValue {
  codesByName: ReadonlyMap<string, KnownPermissionCode>;
  sortedCodes: readonly KnownPermissionCode[];
}

let permissionCodeIndex: PermissionCodeIndexValue | undefined;

const isDeclaredCode = (value: number | string): value is PermissionCode => typeof value === 'number';

const isKnownCode = (code: PermissionCode): code is KnownPermissionCode => code !== PermissionCode.UNSPECIFIED;

const toPermissionName = (enumKey: string): PermissionNameValue => enumKey.toLowerCase() as PermissionNameValue;

export const getPermissionName = (code: KnownPermissionCode): PermissionNameValue =>
  toPermissionName(PermissionCode[code]);

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
