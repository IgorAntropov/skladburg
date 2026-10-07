import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import { DEMO_USER_HEADER } from '../protocol';

export interface ActingContextValue {
  organizationId: string | undefined;
  userId: string | undefined;
}

const readHeader = (headers: Headers, name: string): string | undefined => {
  const value = headers.get(name)?.trim();

  return value === undefined || value === '' ? undefined : value;
};

export const readActingContext = (headers: Headers): ActingContextValue => ({
  organizationId: readHeader(headers, ACTING_ORGANIZATION_HEADER),
  userId: readHeader(headers, DEMO_USER_HEADER),
});
