import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';

import type { AppAddressValue } from '@/shared/routing';

import {
  isCameraLink,
  toObjectAddress,
} from '@/entities/notification';

export type NotificationLinkKind = 'map' | 'open' | 'organization';

export type NotificationLinkLabelKey
  = | 'notification.link.map'
    | 'notification.link.open'
    | 'notification.link.organization';

export interface NotificationLinkValue {
  address: AppAddressValue;
  id: string;
  isFocusRequested: boolean;
  kind: NotificationLinkKind;
  labelKey: NotificationLinkLabelKey;
}

const KIND_BY_LABEL_KEY: Record<NotificationLinkLabelKey, NotificationLinkKind> = {
  'notification.link.map': 'map',
  'notification.link.open': 'open',
  'notification.link.organization': 'organization',
};

const MAX_LINKS_PER_NOTIFICATION = 2;

const resolveLabelKey = (address: AppAddressValue, link: ObjectLink): NotificationLinkLabelKey => {
  if (address.kind === 'object' && address.object.type === 'organization') {
    return 'notification.link.organization';
  }

  return isCameraLink(link) ? 'notification.link.map' : 'notification.link.open';
};

export const resolveNotificationLinks = (links: readonly ObjectLink[]): NotificationLinkValue[] => {
  const resolved: NotificationLinkValue[] = [];
  const usedLabelKeys = new Set<NotificationLinkLabelKey>();

  for (const link of links) {
    const address = toObjectAddress(link);

    if (address === undefined) {
      continue;
    }

    const labelKey = resolveLabelKey(address, link);

    if (usedLabelKeys.has(labelKey)) {
      continue;
    }

    usedLabelKeys.add(labelKey);
    resolved.push({
      address,
      id: `${labelKey}:${link.target?.id ?? ''}`,
      isFocusRequested: isCameraLink(link),
      kind: KIND_BY_LABEL_KEY[labelKey],
      labelKey,
    });

    if (resolved.length === MAX_LINKS_PER_NOTIFICATION) {
      break;
    }
  }

  return resolved;
};
