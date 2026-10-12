import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  Fragment,
  useState,
} from 'react';

import { useActingContext } from '@/shared/api';

import {
  BOOT_SKELETON_TIMING,
  BootSkeletonTimingProvider,
} from './bootSkeletonTiming';

interface ActingContextBoundaryProps {
  children: ReactNode;
}

export const ActingContextBoundary = ({ children }: ActingContextBoundaryProps): ReactElement => {
  const { organizationId, userId } = useActingContext();

  const contextKey = `${organizationId ?? ''}:${userId ?? ''}`;
  const [firstContextKey, setFirstContextKey] = useState<string | undefined>(contextKey);

  if (firstContextKey !== undefined && firstContextKey !== contextKey) {
    setFirstContextKey(undefined);
  }

  const skeletonTiming = firstContextKey === undefined ? undefined : BOOT_SKELETON_TIMING;

  return (
    <BootSkeletonTimingProvider value={skeletonTiming}>
      <Fragment key={contextKey}>{children}</Fragment>
    </BootSkeletonTimingProvider>
  );
};
