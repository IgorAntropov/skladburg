import { create } from '@bufbuild/protobuf';
import {
  DigestItemKind,
  DigestItemSchema,
} from '@skladburg/contracts/notification/v1/notification';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildDigestReplica } from './buildDigestReplica';

const createItem = (init: Parameters<typeof create<typeof DigestItemSchema>>[1]): ReturnType<typeof create<typeof DigestItemSchema>> => {
  return create(DigestItemSchema, init);
};

describe('buildDigestReplica', () => {
  it('turns the items into lines in the order of the engine', () => {
    const replica = buildDigestReplica([
      createItem({ count: 3, kind: DigestItemKind.UNREAD_NOTIFICATIONS }),
      createItem({ count: 2, kind: DigestItemKind.OWN_WAREHOUSES }),
    ], 'digest:1');

    expect(replica?.id).toBe('digest:1');
    expect(replica?.importance).toBe('normal');
    expect(replica?.body).toEqual({
      kind: 'digest',
      lines: [
        { count: 3, key: 'assistant.digest.unread', kind: 'count' },
        { count: 2, key: 'assistant.digest.ownWarehouses', kind: 'count' },
      ],
    });
  });

  it('takes the level of the next verification from nextLevel and not from count', () => {
    const replica = buildDigestReplica([
      createItem({ count: 0, kind: DigestItemKind.VERIFICATION_NEXT_LEVEL, nextLevel: 3 }),
    ], 'digest:1');

    expect(replica?.body).toEqual({ kind: 'digest', lines: [{ kind: 'nextLevel', nextLevel: 3 }] });
  });

  it.each([
    [ProfileKind.SUPPLIER, 'assistant.digest.verifiedSuppliers'],
    [ProfileKind.CUSTOMER, 'assistant.digest.verifiedCustomers'],
    [ProfileKind.CARRIER, 'assistant.digest.verifiedCarriers'],
    [ProfileKind.UNSPECIFIED, 'assistant.digest.verifiedPartners'],
  ] as const)('names the partners of side %s with %s', (partnerSide, key) => {
    const replica = buildDigestReplica([
      createItem({ count: 5, kind: DigestItemKind.VERIFIED_PARTNERS, partnerSide }),
    ], 'digest:1');

    expect(replica?.body).toEqual({ kind: 'digest', lines: [{ count: 5, key, kind: 'count' }] });
  });

  it('offers the center only when there are unread notifications', () => {
    const withUnread = buildDigestReplica([createItem({ count: 1, kind: DigestItemKind.UNREAD_NOTIFICATIONS })], 'digest:1');
    const withoutUnread = buildDigestReplica([createItem({ count: 1, kind: DigestItemKind.OWN_WAREHOUSES })], 'digest:1');

    expect(withUnread?.hasCenterLink).toBe(true);
    expect(withoutUnread?.hasCenterLink).toBe(false);
  });

  it('keeps at most four lines', () => {
    const replica = buildDigestReplica([
      createItem({ count: 1, kind: DigestItemKind.UNREAD_NOTIFICATIONS }),
      createItem({ count: 1, kind: DigestItemKind.OWN_WAREHOUSES }),
      createItem({ count: 1, kind: DigestItemKind.VERIFIED_PARTNERS, partnerSide: ProfileKind.SUPPLIER }),
      createItem({ kind: DigestItemKind.VERIFICATION_NEXT_LEVEL, nextLevel: 2 }),
      createItem({ count: 9, kind: DigestItemKind.VERIFIED_PARTNERS, partnerSide: ProfileKind.CARRIER }),
    ], 'digest:1');

    expect(replica?.body.kind === 'digest' ? replica.body.lines : []).toHaveLength(4);
  });

  it('skips empty and unknown items and says nothing when no line is left', () => {
    expect(buildDigestReplica([], 'digest:1')).toBeUndefined();
    expect(buildDigestReplica([
      createItem({ count: 0, kind: DigestItemKind.OWN_WAREHOUSES }),
      createItem({ count: 4, kind: DigestItemKind.UNSPECIFIED }),
      createItem({ kind: DigestItemKind.VERIFICATION_NEXT_LEVEL, nextLevel: 0 }),
    ], 'digest:1')).toBeUndefined();
  });
});
