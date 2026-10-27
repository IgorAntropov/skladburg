import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';

import {
  create,
  fromJson,
} from '@bufbuild/protobuf';
import {
  ObjectKind,
  ObjectLinkSchema,
  ObjectRefSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { OBJECT_TYPES } from '@/shared/routing';

import { isCameraLink } from './isCameraLink';
import { toObjectAddress } from './toObjectAddress';

const OBJECT_ID = 'f0000010-0000-4000-8000-000000000000';

const OBJECT_TYPE_BY_KIND_NAME = [
  [ObjectKind.CELL, 'cell'],
  [ObjectKind.CITY, 'city'],
  [ObjectKind.DASHBOARD, 'dashboard'],
  [ObjectKind.DEAL, 'deal'],
  [ObjectKind.DOCUMENT, 'document'],
  [ObjectKind.HANDLING_UNIT, 'handling_unit'],
  [ObjectKind.ORGANIZATION, 'organization'],
  [ObjectKind.SITE, 'site'],
  [ObjectKind.TRIP, 'trip'],
  [ObjectKind.VEHICLE, 'vehicle'],
  [ObjectKind.WAREHOUSE, 'warehouse'],
] as const;

const createLink = (kind: ObjectKind, cameraFocusKind?: ObjectKind): ObjectLink => create(
  ObjectLinkSchema,
  {
    cameraFocus: cameraFocusKind === undefined ? undefined : create(ObjectRefSchema, { id: OBJECT_ID, kind: cameraFocusKind }),
    target: create(ObjectRefSchema, { id: OBJECT_ID, kind }),
  },
);

describe('toObjectAddress', () => {
  it.each(OBJECT_TYPE_BY_KIND_NAME)('maps the object kind %s to the address type %s', (kind, type) => {
    expect(toObjectAddress(createLink(kind))).toEqual({ kind: 'object', object: { id: OBJECT_ID, type } });
  });

  it('covers every known object kind exactly once and matches the address object types', () => {
    const knownKinds = Object.values(ObjectKind).filter(
      (value): value is ObjectKind => typeof value === 'number' && value !== ObjectKind.UNSPECIFIED,
    );
    const mappedKinds = OBJECT_TYPE_BY_KIND_NAME.map(([kind]) => kind);
    const mappedTypes = OBJECT_TYPE_BY_KIND_NAME.map(([, type]) => type);

    expect([...mappedKinds].sort((first, second) => first - second)).toEqual(knownKinds);
    expect(new Set(mappedTypes).size).toBe(mappedTypes.length);
    expect([...mappedTypes].sort()).toEqual([...OBJECT_TYPES].sort());
  });

  it('returns nothing for an unspecified kind', () => {
    expect(toObjectAddress(createLink(ObjectKind.UNSPECIFIED))).toBeUndefined();
  });

  it('returns nothing for a kind unknown to this version', () => {
    const link = fromJson(ObjectLinkSchema, { target: { id: OBJECT_ID, kind: 999 } });

    expect(toObjectAddress(link)).toBeUndefined();
  });

  it('returns nothing for a link without a target', () => {
    expect(toObjectAddress(create(ObjectLinkSchema, {}))).toBeUndefined();
  });
});

describe('isCameraLink', () => {
  it('is true when the link has a camera focus of a known kind', () => {
    expect(isCameraLink(createLink(ObjectKind.ORGANIZATION, ObjectKind.SITE))).toBe(true);
  });

  it('is false without a camera focus', () => {
    expect(isCameraLink(createLink(ObjectKind.ORGANIZATION))).toBe(false);
  });

  it('is false when the camera focus kind is unspecified', () => {
    expect(isCameraLink(createLink(ObjectKind.ORGANIZATION, ObjectKind.UNSPECIFIED))).toBe(false);
  });
});
