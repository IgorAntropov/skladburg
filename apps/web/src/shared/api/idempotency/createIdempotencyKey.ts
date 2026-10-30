import { createUuid } from '../ids/createUuid';

export const createIdempotencyKey = (): string => createUuid();
