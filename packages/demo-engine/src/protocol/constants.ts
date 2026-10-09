export const ENGINE_BASE_URL = 'https://demo-engine.invalid';
export const DEMO_USER_HEADER = 'x-demo-user-id';
export const ENGINE_REQUEST_TIMEOUT_MS = 10_000;
export const ENGINE_PROTOCOL_VERSION = 2;

export const DemoPersonaKind = {
  BUYER: 'buyer',
  CARRIER: 'carrier',
  SELLER: 'seller',
  STOREKEEPER: 'storekeeper',
} as const;

export type DemoPersonaKind = typeof DemoPersonaKind[keyof typeof DemoPersonaKind];

export const DemoPersonaGroup = {
  CONSTRUCTION: 'construction',
  FRESH: 'fresh',
} as const;

export type DemoPersonaGroup = typeof DemoPersonaGroup[keyof typeof DemoPersonaGroup];
