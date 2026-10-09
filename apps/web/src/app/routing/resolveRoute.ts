import type {
  AppAddressValue,
  AppSectionValue,
  ObjectRefValue,
} from '@/shared/routing';

import { getPlacedAddressSection } from '@/shared/routing';

export type RouteResolutionValue
  = | { focus: ObjectRefValue | undefined; kind: 'page'; section: AppSectionValue }
    | { kind: 'not-found' }
    | { kind: 'object-unavailable' }
    | { kind: 'redirect' };

export const resolveRoute = (
  address: AppAddressValue | undefined,
  sections: readonly AppSectionValue[],
): RouteResolutionValue => {
  if (address === undefined) {
    return { kind: 'not-found' };
  }

  if (address.kind === 'home') {
    return { kind: 'redirect' };
  }

  const section = getPlacedAddressSection(address);

  if (sections.includes(section)) {
    return { focus: address.kind === 'object' ? address.object : undefined, kind: 'page', section };
  }

  return address.kind === 'object' ? { kind: 'object-unavailable' } : { kind: 'redirect' };
};
