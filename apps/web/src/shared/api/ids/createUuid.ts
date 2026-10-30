import { createUuidGenerator } from '@skladburg/contracts/uuid';

export const createUuid: () => string = createUuidGenerator(globalThis.crypto);
