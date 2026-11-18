import { createContextKey } from '@connectrpc/connect';

export const engineTabIdKey = createContextKey<string | undefined>(undefined);
