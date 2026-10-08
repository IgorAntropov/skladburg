import type { Interceptor } from '@connectrpc/connect';

import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type { IActingContextStore } from '../context/actingContextTypes';

import { createHeaderInterceptor } from './createHeaderInterceptor';

export const createActingOrganizationInterceptor = (actingContext: IActingContextStore): Interceptor =>
  createHeaderInterceptor(ACTING_ORGANIZATION_HEADER, () => actingContext.get().organizationId);
