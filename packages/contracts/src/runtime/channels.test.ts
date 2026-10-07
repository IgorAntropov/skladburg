import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  organizationChannel,
  parseChannel,
  userChannel,
  warehouseChannel,
} from './channels';

const organizationId = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const userId = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const warehouseId = 'c5a3e9f1-7b24-4d86-a0c1-5e9d3b7f2a64';

describe('channel names', () => {
  it('builds an organization channel', () => {
    expect(organizationChannel(organizationId)).toBe(`org:${organizationId}`);
  });

  it('builds a user channel', () => {
    expect(userChannel(userId)).toBe(`user:${userId}`);
  });

  it('builds a warehouse channel', () => {
    expect(warehouseChannel(warehouseId)).toBe(`warehouse:${warehouseId}`);
  });
});

describe('parseChannel', () => {
  it('parses an organization channel', () => {
    expect(parseChannel(organizationChannel(organizationId))).toEqual({ kind: 'organization', organizationId });
  });

  it('parses a user channel', () => {
    expect(parseChannel(userChannel(userId))).toEqual({ kind: 'user', userId });
  });

  it('parses a warehouse channel', () => {
    expect(parseChannel(warehouseChannel(warehouseId))).toEqual({ kind: 'warehouse', warehouseId });
  });

  it.each([
    '',
    'org',
    'org:',
    'user:',
    'warehouse:',
    ':id',
    'deal:3f2b8c1e',
    'ORG:3f2b8c1e',
    'org:3f2b8c1e:extra',
    'org: 3f2b8c1e',
    'org:3f2b8c1e\n',
    'xorg:3f2b8c1e',
    'WAREHOUSE:3f2b8c1e',
    'warehouse:3f2b8c1e:extra',
    'xwarehouse:3f2b8c1e',
    'warehouse: 3f2b8c1e',
  ])('returns undefined for the malformed channel %j', (channel) => {
    expect(parseChannel(channel)).toBeUndefined();
  });
});
