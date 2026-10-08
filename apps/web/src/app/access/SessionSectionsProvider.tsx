import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useMemo,
  useState,
} from 'react';

import {
  resolveAvailableSections,
  selectLandingSection,
  useSessionQuery,
} from '@/entities/session';

import type { AvailableSectionsValue } from './availableSectionsTypes';

import { AvailableSectionsProvider } from './AvailableSectionsProvider';

interface SessionSectionsProviderProps {
  children: ReactNode;
}

export const SessionSectionsProvider = ({ children }: SessionSectionsProviderProps): ReactElement => {
  const {
    data: session,
    error,
    refetch,
  } = useSessionQuery();

  const [retryingError, setRetryingError] = useState<Error | undefined>();

  const value = useMemo((): AvailableSectionsValue => {
    if (session !== undefined) {
      const sections = resolveAvailableSections(session);
      const landingSection = selectLandingSection(sections);

      return landingSection === undefined ? { kind: 'empty' } : { kind: 'ready', landingSection, sections };
    }

    const failure = error ?? retryingError;

    if (failure === undefined) {
      return { kind: 'loading' };
    }

    const isRetrying = error === null;

    return {
      error: failure,
      isRetrying,
      kind: 'error',
      onRetry: (): void => {
        if (isRetrying) {
          return;
        }
        setRetryingError(failure);
        void refetch().finally(() => {
          setRetryingError(undefined);
        });
      },
    };
  }, [error, refetch, retryingError, session]);

  return <AvailableSectionsProvider value={value}>{children}</AvailableSectionsProvider>;
};
