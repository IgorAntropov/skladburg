const CHANNEL_SEPARATOR = ':';
const MARKET_CHANNEL = 'market';
const DEAL_CHANNEL_PREFIX = 'deal';
const INVENTORY_CHANNEL_PREFIX = 'inventory';
const ORGANIZATION_CHANNEL_PREFIX = 'org';
const TASKS_CHANNEL_PREFIX = 'tasks';
const USER_CHANNEL_PREFIX = 'user';
const WAREHOUSE_CHANNEL_PREFIX = 'warehouse';
const CHANNEL_PATTERN = /^([a-z]+):([A-Za-z0-9_-]+)$/u;

export type ChannelValue
  = | { dealId: string; kind: 'deal' }
    | { kind: 'inventory'; warehouseId: string }
    | { kind: 'market' }
    | { kind: 'organization'; organizationId: string }
    | { kind: 'tasks'; warehouseId: string }
    | { kind: 'user'; userId: string }
    | { kind: 'warehouse'; warehouseId: string };

export const dealChannel = (dealId: string): string => `${DEAL_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${dealId}`;

export const inventoryChannel = (warehouseId: string): string => `${INVENTORY_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${warehouseId}`;

export const marketChannel = (): string => MARKET_CHANNEL;

export const organizationChannel = (organizationId: string): string =>
  `${ORGANIZATION_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${organizationId}`;

export const tasksChannel = (warehouseId: string): string => `${TASKS_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${warehouseId}`;

export const userChannel = (userId: string): string =>
  `${USER_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${userId}`;

export const warehouseChannel = (warehouseId: string): string =>
  `${WAREHOUSE_CHANNEL_PREFIX}${CHANNEL_SEPARATOR}${warehouseId}`;

export const parseChannel = (channel: string): ChannelValue | undefined => {
  if (channel === MARKET_CHANNEL) {
    return { kind: 'market' };
  }

  const match = CHANNEL_PATTERN.exec(channel);
  const [, prefix, id] = match ?? [];

  if (id === undefined) {
    return undefined;
  }

  if (prefix === DEAL_CHANNEL_PREFIX) {
    return { dealId: id, kind: 'deal' };
  }

  if (prefix === ORGANIZATION_CHANNEL_PREFIX) {
    return { kind: 'organization', organizationId: id };
  }

  if (prefix === USER_CHANNEL_PREFIX) {
    return { kind: 'user', userId: id };
  }

  if (prefix === INVENTORY_CHANNEL_PREFIX || prefix === TASKS_CHANNEL_PREFIX || prefix === WAREHOUSE_CHANNEL_PREFIX) {
    return { kind: prefix, warehouseId: id };
  }

  return undefined;
};
