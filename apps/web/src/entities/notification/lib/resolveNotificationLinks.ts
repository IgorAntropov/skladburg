import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';

import type { AppAddressValue } from '@/shared/routing';

import { isCameraLink } from './isCameraLink';
import { toObjectAddress } from './toObjectAddress';

export type NotificationLinkKind = 'map' | 'open' | 'organization';

export interface ResolvedNotificationLinkValue {
  address: AppAddressValue;
  id: string;
  isFocusRequested: boolean;
  kind: NotificationLinkKind;
}

const MAX_LINKS_PER_NOTIFICATION = 2;

const resolveKind = (address: AppAddressValue, link: ObjectLink): NotificationLinkKind => {
  if (address.kind === 'object' && address.object.type === 'organization') {
    return 'organization';
  }

  return isCameraLink(link) ? 'map' : 'open';
};

export const resolveNotificationLinks = (links: readonly ObjectLink[]): ResolvedNotificationLinkValue[] => {
  const resolved: ResolvedNotificationLinkValue[] = [];
  const usedKinds = new Set<NotificationLinkKind>();

  for (const link of links) {
    const address = toObjectAddress(link);

    if (address === undefined) {
      continue;
    }

    const kind = resolveKind(address, link);

    if (usedKinds.has(kind)) {
      continue;
    }

    usedKinds.add(kind);
    resolved.push({
      address,
      id: `${kind}:${link.target?.id ?? ''}`,
      isFocusRequested: isCameraLink(link),
      kind,
    });

    if (resolved.length === MAX_LINKS_PER_NOTIFICATION) {
      break;
    }
  }

  return resolved;
};
