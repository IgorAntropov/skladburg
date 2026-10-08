import type {
  AppAddressValue,
  AppSectionValue,
  ObjectTypeValue,
} from './addressTypes';

import {
  APP_SECTIONS,
  OBJECT_PATH_SEGMENTS,
  OBJECT_TYPES,
} from './addressTypes';

const OBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const findSection = (segment: string): AppSectionValue | undefined => {
  return APP_SECTIONS.find(section => section === segment);
};

const findObjectType = (segment: string): ObjectTypeValue | undefined => {
  return OBJECT_TYPES.find(type => OBJECT_PATH_SEGMENTS[type] === segment);
};

export const parseAddressPath = (path: string): AppAddressValue | undefined => {
  if (path === '/') {
    return { kind: 'home' };
  }

  if (!path.startsWith('/')) {
    return undefined;
  }

  const trimmedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const segments = trimmedPath.slice(1).split('/');
  const [firstSegment, secondSegment] = segments;

  if (firstSegment === undefined) {
    return undefined;
  }

  if (segments.length === 1) {
    const section = findSection(firstSegment);

    return section === undefined ? undefined : { kind: 'section', section };
  }

  if (segments.length !== 2 || secondSegment === undefined || !OBJECT_ID_PATTERN.test(secondSegment)) {
    return undefined;
  }

  const type = findObjectType(firstSegment);

  return type === undefined ? undefined : { kind: 'object', object: { id: secondSegment, type } };
};
