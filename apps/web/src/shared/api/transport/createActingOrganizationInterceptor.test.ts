import { createConnectTransport } from '@connectrpc/connect-web';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createApiClient } from '../client/createApiClient';
import { createActingContextStore } from '../context/createActingContextStore';
import { createActingOrganizationInterceptor } from './createActingOrganizationInterceptor';
import { createFetchSpy } from './testing/createFetchSpy';

const callWithContext = async (organizationId: string | undefined, nextOrganizationId?: string): Promise<(null | string)[]> => {
  const actingContext = createActingContextStore({ organizationId, userId: undefined });
  const spy = createFetchSpy();
  const client = createApiClient(createConnectTransport({
    baseUrl: 'https://api.test',
    fetch: spy.fetch,
    interceptors: [createActingOrganizationInterceptor(actingContext)],
    useBinaryFormat: true,
  }));

  await client.organization.listWarehouses({}).catch(() => undefined);

  if (nextOrganizationId !== undefined) {
    actingContext.set({ organizationId: nextOrganizationId, userId: undefined });
    await client.organization.listWarehouses({}).catch(() => undefined);
  }

  return spy.requests.map(request => request.headers.get(ACTING_ORGANIZATION_HEADER));
};

describe('createActingOrganizationInterceptor', () => {
  it('sets the organization header from the acting context', async () => {
    expect(await callWithContext('org-1')).toEqual(['org-1']);
  });

  it('reads the context at call time', async () => {
    expect(await callWithContext('org-1', 'org-2')).toEqual(['org-1', 'org-2']);
  });

  it('does not set the header when the organization is not chosen', async () => {
    expect(await callWithContext(undefined)).toEqual([null]);
  });

  it('does not set the header when the organization is empty', async () => {
    expect(await callWithContext('')).toEqual([null]);
  });
});
