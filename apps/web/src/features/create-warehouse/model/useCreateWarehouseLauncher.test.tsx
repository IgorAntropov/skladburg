import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { MockInstance } from 'vitest';

import { create } from '@bufbuild/protobuf';
import { WarehouseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  act,
  cleanup,
  render,
  renderHook,
} from '@testing-library/react';
import { useEffect } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CommandAccessValue } from '@/shared/api';

type LauncherModuleValue = typeof import('./useCreateWarehouseLauncher');
type LoadFormType = typeof import('../ui/loadCreateWarehouseForm').loadCreateWarehouseForm;
type UseFocusHandoffType = typeof import('@/shared/ui').useFocusHandoff;

vi.mock('@/entities/session', () => ({ useCommandAccess: vi.fn() }));
vi.mock('../ui/loadCreateWarehouseForm', () => ({ loadCreateWarehouseForm: vi.fn() }));

const ALLOWED_ACCESS: CommandAccessValue = { status: 'allowed' };
const DENIED_ACCESS: CommandAccessValue = { permission: 'warehouse_create', status: 'denied' };
const FOCUS_KEY = 'create-warehouse';
const CHUNK_UNAVAILABLE = 'the form chunk is unavailable';

const CREATED_WAREHOUSE = create(WarehouseSchema, { id: 'w-1', name: 'Склад на Южной' });
const CREATED_ANNOUNCEMENT = defaultLocaleCatalog['warehouse.create.created'].replace('{name}', 'Склад на Южной');

interface RenderedHookValue {
  handoff: ReturnType<UseFocusHandoffType>;
  launcher: ReturnType<LauncherModuleValue['useCreateWarehouseLauncher']>;
}

interface RenderedLauncherValue {
  loadForm: LoadFormType;
  queryPlaces: MockInstance<QueryClient['query']>;
  result: { current: RenderedHookValue };
  useHandoff: UseFocusHandoffType;
  useLauncher: LauncherModuleValue['useCreateWarehouseLauncher'];
  Wrapper: (props: { children: ReactNode }) => ReactElement;
}

interface RenderLauncherOptionsValue {
  access?: CommandAccessValue;
  formGate?: Promise<void>;
  rejectedLoadCount?: number;
}

const StubForm = (): ReactElement => <div data-testid="stub-form" />;

const renderLauncher = async ({
  access = ALLOWED_ACCESS,
  formGate,
  rejectedLoadCount = 0,
}: RenderLauncherOptionsValue = {}): Promise<RenderedLauncherValue> => {
  vi.resetModules();

  const [
    { createTestRuntime },
    { createQueryClient },
    { ApiRuntimeProvider },
    { LocalizerProvider },
    { QueryClientProvider },
    { FocusHandoffProvider, LiveRegionProvider, useFocusHandoff },
    session,
    loader,
    launcherModule,
    i18n,
  ] = await Promise.all([
    import('@/shared/api/index.testing'),
    import('@/shared/api'),
    import('@/shared/api'),
    import('@/shared/i18n'),
    import('@tanstack/react-query'),
    import('@/shared/ui'),
    import('@/entities/session'),
    import('../ui/loadCreateWarehouseForm'),
    import('./useCreateWarehouseLauncher'),
    import('@/shared/i18n'),
  ]);

  vi.mocked(session.useCommandAccess).mockReturnValue(access);

  let rejectedCount = 0;
  vi.mocked(loader.loadCreateWarehouseForm).mockReset();
  vi.mocked(loader.loadCreateWarehouseForm).mockImplementation(async () => {
    await formGate;
    if (rejectedCount < rejectedLoadCount) {
      rejectedCount += 1;

      throw new Error(CHUNK_UNAVAILABLE);
    }

    return { CreateWarehouseForm: StubForm };
  });

  const localizer = await i18n.createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });
  const runtime = createTestRuntime();
  const queryClient = createQueryClient({ networkMode: 'always' });
  const queryPlaces = vi.spyOn(queryClient, 'query');

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <LiveRegionProvider>
            <FocusHandoffProvider>{children}</FocusHandoffProvider>
          </LiveRegionProvider>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>
  );

  const { result } = renderHook(() => ({
    handoff: useFocusHandoff<HTMLButtonElement>(FOCUS_KEY),
    launcher: launcherModule.useCreateWarehouseLauncher(),
  }), { wrapper: Wrapper });

  return {
    loadForm: loader.loadCreateWarehouseForm,
    queryPlaces,
    result,
    useHandoff: useFocusHandoff,
    useLauncher: launcherModule.useCreateWarehouseLauncher,
    Wrapper,
  };
};

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const getLastAnnouncement = (): string => {
  const regions = document.querySelectorAll('[aria-live="polite"]');

  return regions[regions.length - 1]?.textContent ?? '';
};

const flushPromises = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

const createFocusTarget = (): HTMLButtonElement => {
  const target = document.createElement('button');

  document.body.append(target);

  return target;
};

describe('useCreateWarehouseLauncher', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it('keeps the chunk and the places untouched without the permission', async () => {
    const { loadForm, queryPlaces, result } = await renderLauncher({ access: DENIED_ACCESS });

    await act(async () => {
      result.current.launcher.warmUp();
      result.current.launcher.open();
      await Promise.resolve();
    });

    expect(loadForm).not.toHaveBeenCalled();
    expect(queryPlaces).not.toHaveBeenCalled();
    expect(result.current.launcher.isLoading).toBe(false);
    expect(result.current.launcher.isOpen).toBe(false);
  });

  it('warms the chunk and the places up once the permission is there', async () => {
    const { loadForm, queryPlaces, result } = await renderLauncher();

    await act(async () => {
      result.current.launcher.warmUp();
      await Promise.resolve();
    });

    expect(loadForm).toHaveBeenCalledTimes(1);
    expect(queryPlaces).toHaveBeenCalledTimes(1);
    expect(result.current.launcher.isOpen).toBe(false);
  });

  it('shows the loading state first and opens the form once the chunk is there', async () => {
    let openGate: () => void = () => undefined;
    const formGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const { result } = await renderLauncher({ formGate });

    act(() => {
      result.current.launcher.open();
    });

    expect(result.current.launcher.isLoading).toBe(true);
    expect(result.current.launcher.isOpen).toBe(false);
    expect(result.current.launcher.Form).toBeUndefined();

    await act(async () => {
      openGate();
      await formGate;
    });
    await flushPromises();

    expect(result.current.launcher.isLoading).toBe(false);
    expect(result.current.launcher.isOpen).toBe(true);
    expect(result.current.launcher.Form).toBeDefined();
  });

  it('opens at once when the chunk is already loaded', async () => {
    const { result } = await renderLauncher();

    await act(async () => {
      result.current.launcher.warmUp();
      await Promise.resolve();
    });
    await flushPromises();

    act(() => {
      result.current.launcher.open();
    });

    expect(result.current.launcher.isLoading).toBe(false);
    expect(result.current.launcher.isOpen).toBe(true);
  });

  it('ignores a second open while the chunk is loading', async () => {
    let openGate: () => void = () => undefined;
    const formGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const { loadForm, result } = await renderLauncher({ formGate });

    act(() => {
      result.current.launcher.open();
    });
    act(() => {
      result.current.launcher.open();
    });

    expect(loadForm).toHaveBeenCalledTimes(1);

    await act(async () => {
      openGate();
      await formGate;
    });
    await flushPromises();

    expect(result.current.launcher.isOpen).toBe(true);
  });

  it('reports a failed chunk and loads it again on the next open', async () => {
    const { loadForm, result } = await renderLauncher({ rejectedLoadCount: 1 });

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    expect(result.current.launcher.loadRecovery).toBe('retry');
    expect(result.current.launcher.isOpen).toBe(false);
    expect(result.current.launcher.isLoading).toBe(false);

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    expect(loadForm).toHaveBeenCalledTimes(2);
    expect(result.current.launcher.loadRecovery).toBeUndefined();
    expect(result.current.launcher.isOpen).toBe(true);
  });

  it('asks for a reload when the chunk fails again', async () => {
    const { result } = await renderLauncher({ rejectedLoadCount: 2 });

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();
    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    expect(result.current.launcher.loadRecovery).toBe('reload');
  });

  it('moves the focus into the first field instead of closing an open form', async () => {
    const { result } = await renderLauncher();

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    const panel = document.createElement('section');
    const field = document.createElement('input');
    panel.id = result.current.launcher.panelId;
    panel.append(field);
    document.body.append(panel);

    act(() => {
      result.current.launcher.open();
    });

    expect(result.current.launcher.isOpen).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('closes the form and gives the focus back to the button', async () => {
    const { result } = await renderLauncher();

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    act(() => {
      result.current.launcher.close();
    });

    expect(result.current.launcher.isOpen).toBe(false);
    expect(getAnnouncement()).toBe('');

    const target = createFocusTarget();
    result.current.handoff.ref(target);

    expect(document.activeElement).toBe(target);
  });

  it('completes with an announcement and gives the focus back to the button', async () => {
    const { result } = await renderLauncher();

    await act(async () => {
      result.current.launcher.open();
      await Promise.resolve();
    });
    await flushPromises();

    act(() => {
      result.current.launcher.complete(CREATED_WAREHOUSE);
    });

    expect(result.current.launcher.isOpen).toBe(false);
    expect(getAnnouncement()).toBe(CREATED_ANNOUNCEMENT);

    const target = createFocusTarget();
    result.current.handoff.ref(target);

    expect(document.activeElement).toBe(target);
  });

  it('does not take the focus when the form was never closed', async () => {
    const { result } = await renderLauncher();

    const target = createFocusTarget();
    result.current.handoff.ref(target);

    expect(document.activeElement).not.toBe(target);
  });

  describe('when the launcher is gone before the warehouse is created', () => {
    interface MountedTreeValue {
      handoff: { current: ReturnType<UseFocusHandoffType> | undefined };
      launcher: { current: ReturnType<LauncherModuleValue['useCreateWarehouseLauncher']> | undefined };
      unmountLauncher: () => void;
    }

    const mountTree = async (options: RenderLauncherOptionsValue = {}): Promise<MountedTreeValue> => {
      const { useHandoff, useLauncher, Wrapper } = await renderLauncher(options);
      const handoff: MountedTreeValue['handoff'] = { current: undefined };
      const launcher: MountedTreeValue['launcher'] = { current: undefined };

      const HandoffProbe = (): null => {
        const value = useHandoff<HTMLButtonElement>(FOCUS_KEY);

        useEffect(() => {
          handoff.current = value;
        }, [value]);

        return null;
      };

      const LauncherProbe = (): null => {
        const value = useLauncher();

        useEffect(() => {
          launcher.current = value;
        }, [value]);

        return null;
      };

      const renderTree = (isLauncherMounted: boolean): ReactElement => (
        <Wrapper>
          <HandoffProbe />
          {isLauncherMounted && <LauncherProbe />}
        </Wrapper>
      );

      const { rerender } = render(renderTree(true));

      return {
        handoff,
        launcher,
        unmountLauncher: () => {
          rerender(renderTree(false));
        },
      };
    };

    it('announces the creation but leaves no focus request for the button that mounts later', async () => {
      const { handoff, launcher, unmountLauncher } = await mountTree();

      await act(async () => {
        launcher.current?.open();
        await Promise.resolve();
      });
      await flushPromises();

      const complete = launcher.current?.complete;

      act(() => {
        unmountLauncher();
      });
      act(() => {
        complete?.(CREATED_WAREHOUSE);
      });

      expect(getLastAnnouncement()).toBe(CREATED_ANNOUNCEMENT);

      const target = createFocusTarget();
      handoff.current?.ref(target);

      expect(document.activeElement).not.toBe(target);
    });

    it('does not give the focus away for a form whose chunk arrives after the launcher is gone', async () => {
      let openGate: () => void = () => undefined;
      const formGate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
      const { handoff, launcher, unmountLauncher } = await mountTree({ formGate });
      const complete = launcher.current?.complete;

      act(() => {
        launcher.current?.open();
      });
      act(() => {
        unmountLauncher();
      });
      await act(async () => {
        openGate();
        await formGate;
      });
      await flushPromises();
      act(() => {
        complete?.(CREATED_WAREHOUSE);
      });

      const target = createFocusTarget();
      handoff.current?.ref(target);

      expect(document.activeElement).not.toBe(target);
    });
  });
});
