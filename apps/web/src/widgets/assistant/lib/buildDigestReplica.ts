import type { DigestItem } from '@skladburg/contracts/notification/v1/notification';

import { DigestItemKind } from '@skladburg/contracts/notification/v1/notification';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type {
  DigestLineKey,
  DigestLineValue,
  ReplicaValue,
} from '../model/replicaTypes';

export const MAX_DIGEST_LINES = 4;

const PARTNER_LINE_KEYS = {
  [ProfileKind.CARRIER]: 'assistant.digest.verifiedCarriers',
  [ProfileKind.CUSTOMER]: 'assistant.digest.verifiedCustomers',
  [ProfileKind.SUPPLIER]: 'assistant.digest.verifiedSuppliers',
  [ProfileKind.UNSPECIFIED]: 'assistant.digest.verifiedPartners',
} as const satisfies Record<ProfileKind, DigestLineKey>;

const toCountLine = (key: DigestLineKey, count: number): DigestLineValue | undefined => {
  return count > 0 ? { count, key, kind: 'count' } : undefined;
};

const toDigestLine = (item: DigestItem): DigestLineValue | undefined => {
  switch (item.kind) {
    case DigestItemKind.OWN_WAREHOUSES:
      return toCountLine('assistant.digest.ownWarehouses', item.count);
    case DigestItemKind.UNREAD_NOTIFICATIONS:
      return toCountLine('assistant.digest.unread', item.count);
    case DigestItemKind.UNSPECIFIED:
      return undefined;
    case DigestItemKind.VERIFICATION_NEXT_LEVEL:
      return item.nextLevel > 0 ? { kind: 'nextLevel', nextLevel: item.nextLevel } : undefined;
    case DigestItemKind.VERIFIED_PARTNERS:
      return toCountLine(PARTNER_LINE_KEYS[item.partnerSide], item.count);
  }
};

export const buildDigestReplica = (items: readonly DigestItem[], replicaId: string): ReplicaValue | undefined => {
  const lines = items
    .map(toDigestLine)
    .filter((line): line is DigestLineValue => line !== undefined)
    .slice(0, MAX_DIGEST_LINES);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    body: { kind: 'digest', lines },
    centerAction: lines.some(line => line.kind === 'count' && line.key === 'assistant.digest.unread') ? 'notifications' : undefined,
    id: replicaId,
    importance: 'normal',
    links: [],
  };
};
