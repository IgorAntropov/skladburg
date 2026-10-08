import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Fragment } from 'react';

import { useActingContext } from '@/shared/api';

interface ActingContextBoundaryProps {
  children: ReactNode;
}

export const ActingContextBoundary = ({ children }: ActingContextBoundaryProps): ReactElement => {
  const { organizationId, userId } = useActingContext();

  return <Fragment key={`${organizationId ?? ''}:${userId ?? ''}`}>{children}</Fragment>;
};
