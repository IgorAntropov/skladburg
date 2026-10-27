import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import type {
  AppUpdateStateValue,
  IAppUpdateSource,
} from './appUpdateTypes';
import type { AppUpdateNoticePanelModuleValue } from './createAppUpdateNotice';

import { AppUpdateNotice } from './AppUpdateNotice';
import { AppUpdateNoticePanel } from './AppUpdateNoticePanel';
import { AppUpdateProvider } from './AppUpdateProvider';
import { createAppUpdateNotice } from './createAppUpdateNotice';

interface FakeSourceValue extends IAppUpdateSource {
  setState: (nextState: AppUpdateStateValue) => void;
}

const MESSAGE_READY = defaultLocaleCatalog['app.update.ready'];
const MESSAGE_RELOAD_REQUIRED = defaultLocaleCatalog['app.update.reloadRequired'];
const LABEL_APPLY = defaultLocaleCatalog['app.update.apply'];
const LABEL_DISMISS = defaultLocaleCatalog['app.update.dismiss'];
const LABEL_RELOAD = defaultLocaleCatalog['routing.chunkError.reload'];

const createFakeSource = (initialState: AppUpdateStateValue): FakeSourceValue => {
  const listeners = new Set<() => void>();
  let state = initialState;

  return {
    apply: vi.fn(),
    dismiss: vi.fn(),
    getState: () => state,
    setState: (nextState) => {
      state = nextState;

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const createStubLoader = (): ReturnType<typeof createCachedModuleLoader<AppUpdateNoticePanelModuleValue>> => {
  return createCachedModuleLoader(() => Promise.resolve({ default: AppUpdateNoticePanel }));
};

const createFailingLoader = (): ReturnType<typeof createCachedModuleLoader<AppUpdateNoticePanelModuleValue>> => {
  return createCachedModuleLoader(() => Promise.reject(new Error('chunk is unavailable')));
};

const renderNotice = async (
  Notice: () => null | ReactElement,
  source: IAppUpdateSource,
  location: IMemoryLocation = createMemoryLocation('/'),
): Promise<void> => {
  const localizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });

  render(
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <AppUpdateProvider source={source}>
          <Notice />
        </AppUpdateProvider>
      </LocalizerProvider>
    </RoutingProvider>,
  );
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppUpdateNotice gate', () => {
  it.each<AppUpdateStateValue>(['idle', 'dismissed'])('renders nothing and does not load the panel in the %s state', async (state) => {
    const loader = vi.fn(createStubLoader());
    const Notice = createAppUpdateNotice(Object.assign(loader, { peekLoadedModule: () => undefined }));

    await renderNotice(Notice, createFakeSource(state));

    expect(screen.queryByRole('complementary')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads the panel once the update is ready and applies it on click', async () => {
    const source = createFakeSource('ready');
    const Notice = createAppUpdateNotice(createStubLoader());

    await renderNotice(Notice, source);

    const apply = await screen.findByRole('button', { name: LABEL_APPLY });

    expect(screen.getByRole('complementary', { name: MESSAGE_READY })).toBeTruthy();
    expect(screen.getByRole('button', { name: LABEL_DISMISS })).toBeTruthy();

    fireEvent.click(apply);

    expect(source.apply).toHaveBeenCalledTimes(1);
  });

  it('loads the panel when the update becomes ready and removes it on dismissal', async () => {
    const source = createFakeSource('idle');
    const loader = vi.fn(createStubLoader());
    const Notice = createAppUpdateNotice(Object.assign(loader, { peekLoadedModule: () => undefined }));

    await renderNotice(Notice, source);

    expect(loader).not.toHaveBeenCalled();

    act(() => {
      source.setState('ready');
    });

    await screen.findByRole('button', { name: LABEL_APPLY });

    expect(loader).toHaveBeenCalledTimes(1);

    act(() => {
      source.setState('dismissed');
    });

    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows the reload button of the panel when another tab updated the app', async () => {
    const location = createMemoryLocation('/');
    const Notice = createAppUpdateNotice(createStubLoader());

    await renderNotice(Notice, createFakeSource('reloadRequired'), location);

    fireEvent.click(await screen.findByRole('button', { name: LABEL_RELOAD }));

    expect(screen.getByRole('complementary', { name: MESSAGE_RELOAD_REQUIRED })).toBeTruthy();
    expect(location.reloadCount).toBe(1);
  });

  it('loads the real panel module through the public notice', async () => {
    await renderNotice(AppUpdateNotice, createFakeSource('ready'));

    expect(await screen.findByRole('button', { name: LABEL_DISMISS })).toBeTruthy();
  });
});

describe('AppUpdateNotice fallback', () => {
  it('shows the fallback notice with a single button when the panel fails to load and applies the update', async () => {
    const source = createFakeSource('ready');
    const Notice = createAppUpdateNotice(createFailingLoader());

    await renderNotice(Notice, source);

    const reload = await screen.findByRole('button', { name: LABEL_RELOAD });

    expect(screen.getByRole('complementary', { name: MESSAGE_READY })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: LABEL_DISMISS })).toBeNull();

    fireEvent.click(reload);

    expect(source.apply).toHaveBeenCalledTimes(1);
  });

  it('marks the fallback button as pending while the update is being applied', async () => {
    const source = createFakeSource('applying');
    const Notice = createAppUpdateNotice(createFailingLoader());

    await renderNotice(Notice, source);

    await waitFor(() => {
      expect(screen.getByRole('complementary')).toBeTruthy();
    });

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('button', { name: LABEL_RELOAD })).toBeNull();
  });

  it('reloads the page from the fallback notice when another tab updated the app', async () => {
    const location = createMemoryLocation('/');
    const source = createFakeSource('reloadRequired');
    const Notice = createAppUpdateNotice(createFailingLoader());

    await renderNotice(Notice, source, location);

    fireEvent.click(await screen.findByRole('button', { name: LABEL_RELOAD }));

    expect(screen.getByRole('complementary', { name: MESSAGE_RELOAD_REQUIRED })).toBeTruthy();
    expect(location.reloadCount).toBe(1);
    expect(source.apply).not.toHaveBeenCalled();
  });
});
