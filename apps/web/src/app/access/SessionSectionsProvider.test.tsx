import type { ReactElement } from 'react';

import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ApiRuntimeProvider } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import type { AvailableSectionsValue } from './availableSectionsTypes';

import {
  createSessionFixture,
  createSessionRoutes,
} from '../lib/testing/sessionFixtures';
import { SessionSectionsProvider } from './SessionSectionsProvider';
import { useAvailableSections } from './useAvailableSections';

const summarize = (availableSections: AvailableSectionsValue): string => {
  if (availableSections.kind === 'ready') {
    return `ready ${availableSections.landingSection} ${availableSections.sections.join(',')}`;
  }

  if (availableSections.kind === 'error') {
    return availableSections.isRetrying ? 'error retrying' : 'error';
  }

  return availableSections.kind;
};

const SectionsProbe = (): ReactElement => {
  const availableSections = useAvailableSections();

  const failureMessage = availableSections.kind === 'error' ? availableSections.error.message : '';

  const handleRetryClick = (): void => {
    if (availableSections.kind === 'error') {
      availableSections.onRetry();
    }
  };

  return (
    <div>
      <p data-testid="summary">{summarize(availableSections)}</p>
      <p data-testid="failure">{failureMessage}</p>
      <button data-testid="retry" onClick={handleRetryClick} type="button" />
    </div>
  );
};

const renderProvider = (routes: Parameters<typeof createTestRuntime>[0]): void => {
  const runtime = createTestRuntime(routes);

  render(
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SessionSectionsProvider>
          <SectionsProbe />
        </SessionSectionsProvider>
      </QueryClientProvider>
    </ApiRuntimeProvider>,
  );
};

const getSummary = (): string => screen.getByTestId('summary').textContent;

const getFailureMessage = (): string => screen.getByTestId('failure').textContent;

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('SessionSectionsProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('reports loading until the session arrives and then the sections with the landing one', async () => {
    renderProvider({ routes: createSessionRoutes() });

    expect(getSummary()).toBe('loading');
    await waitFor(() => {
      expect(getSummary()).toBe('ready network network,catalog,deals,warehouse');
    });
  });

  it('gives the sections that follow the profile of the organization', async () => {
    renderProvider({ routes: createSessionRoutes(createSessionFixture({ profiles: [ProfileKind.CARRIER] })) });

    await waitFor(() => {
      expect(getSummary()).toBe('ready network network,deals');
    });
  });

  it('reports empty for an organization without sections', async () => {
    renderProvider({ routes: createSessionRoutes(createSessionFixture({ profiles: [] })) });

    await waitFor(() => {
      expect(getSummary()).toBe('empty');
    });
  });

  it('reports the error and loads the session again on retry', async () => {
    const getSession = vi.fn()
      .mockImplementationOnce(() => {
        throw new ConnectError('denied', Code.PermissionDenied);
      })
      .mockImplementation(() => createSessionFixture());
    renderProvider({ routes: router => router.service(AccessService, { getSession }) });

    await waitFor(() => {
      expect(getSummary()).toBe('error');
    });

    fireEvent.click(screen.getByTestId('retry'));

    await waitFor(() => {
      expect(getSummary()).toBe('ready network network,catalog,deals,warehouse');
    });
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('keeps the error with the flag of the retry while the session loads again', async () => {
    const reload = createDeferred();
    const getSession = vi.fn()
      .mockImplementationOnce(() => {
        throw new ConnectError('denied', Code.PermissionDenied);
      })
      .mockImplementation(async () => {
        await reload.promise;

        return createSessionFixture();
      });
    renderProvider({ routes: router => router.service(AccessService, { getSession }) });

    await waitFor(() => {
      expect(getSummary()).toBe('error');
    });
    const failureMessage = getFailureMessage();

    fireEvent.click(screen.getByTestId('retry'));

    await waitFor(() => {
      expect(getSummary()).toBe('error retrying');
    });
    expect(getFailureMessage()).toBe(failureMessage);

    reload.resolve();

    await waitFor(() => {
      expect(getSummary()).toBe('ready network network,catalog,deals,warehouse');
    });
  });

  it('does not load the session twice when the retry is requested again while it runs', async () => {
    const reload = createDeferred();
    const getSession = vi.fn()
      .mockImplementationOnce(() => {
        throw new ConnectError('denied', Code.PermissionDenied);
      })
      .mockImplementation(async () => {
        await reload.promise;

        return createSessionFixture();
      });
    renderProvider({ routes: router => router.service(AccessService, { getSession }) });
    await waitFor(() => {
      expect(getSummary()).toBe('error');
    });

    fireEvent.click(screen.getByTestId('retry'));
    await waitFor(() => {
      expect(getSummary()).toBe('error retrying');
    });
    fireEvent.click(screen.getByTestId('retry'));
    fireEvent.click(screen.getByTestId('retry'));
    reload.resolve();

    await waitFor(() => {
      expect(getSummary()).toBe('ready network network,catalog,deals,warehouse');
    });
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('returns from the retry to the error without the flag when the session fails again', async () => {
    const reload = createDeferred();
    const getSession = vi.fn()
      .mockImplementationOnce(() => {
        throw new ConnectError('denied', Code.PermissionDenied);
      })
      .mockImplementation(async () => {
        await reload.promise;

        throw new ConnectError('still denied', Code.PermissionDenied);
      });
    renderProvider({ routes: router => router.service(AccessService, { getSession }) });
    await waitFor(() => {
      expect(getSummary()).toBe('error');
    });

    fireEvent.click(screen.getByTestId('retry'));
    await waitFor(() => {
      expect(getSummary()).toBe('error retrying');
    });
    reload.resolve();

    await waitFor(() => {
      expect(getSummary()).toBe('error');
    });
    expect(getFailureMessage()).toContain('still denied');
    expect(getSession).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('retry'));

    await waitFor(() => {
      expect(getSession).toHaveBeenCalledTimes(3);
    });
  });
});
