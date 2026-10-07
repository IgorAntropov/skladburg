const CHANNEL_SEPARATOR = ':';
const ORGANIZATION_CHANNEL_PREFIX = 'org';
const USER_CHANNEL_PREFIX = 'user';
const WAREHOUSE_CHANNEL_PREFIX = 'warehouse';
const CHANNEL_PREFIXES = [
  ORGANIZATION_CHANNEL_PREFIX,
  USER_CHANNEL_PREFIX,
  WAREHOUSE_CHANNEL_PREFIX,
];
const CHANNEL_PATTERN = new RegExp(`^(${CHANNEL_PREFIXES.join('|')})${CHANNEL_SEPARATOR}([A-Za-z0-9_-]+)$`);

export type ChannelValue
  = | { kind: 'organization'; organizationId: string }
    | { kind: 'user'; userId: string }
    | { kind: 'warehouse'; warehouseId: string };

export const organizationChannel = (organizationId: string): string =>
  `${ORGANIZATION_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${organizationId}`;

export const userChannel = (userId: string): string =>
  `${USER_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${userId}`;

export const warehouseChannel = (warehouseId: string): string =>
  `${WAREHOUSE_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${warehouseId}`;

export const parseChannel = (channel: string): ChannelValue | undefined => {
  const match = CHANNEL_PATTERN.exec(channel);
  const [, prefix, id] = match ?? [];

  if (id === undefined) {
    return undefined;
  }

  if (prefix === ORGANIZATION_CHANNEL_PREFIX) {
    return { kind: 'organization', organizationId: id };
  }

  if (prefix === USER_CHANNEL_PREFIX) {
    return { kind: 'user', userId: id };
  }

  return { kind: 'warehouse', warehouseId: id };
};
