import type {
  ComponentType,
  ReactElement,
} from 'react';
import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

import type { IActingContextStore } from '@/shared/api';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import type {
  SearchControllerProps,
  SearchPanelProps,
} from '../model/searchPanelTypes';

interface FieldMocksValue {
  loadPanel: Mock<() => Promise<LoadedPanelModuleValue>>;
}

interface LoadedPanelModuleValue {
  requestGlobalSearchTexts: () => void;
  SearchController: ComponentType<SearchControllerProps>;
}

interface RenderedFieldValue {
  actingContext: IActingContextStore;
  location: IMemoryLocation;
  onPhoneFieldOpenChange: Mock<(isOpen: boolean) => void>;
}

interface RenderFieldOptionsValue {
  gate?: Promise<void> | undefined;
  rejectedLoadCount?: number | undefined;
}

const mocks = vi.hoisted((): FieldMocksValue => ({
  loadPanel: vi.fn<() => Promise<LoadedPanelModuleValue>>(),
}));

vi.mock('./loadSearchPanel', () => ({
  loadSearchPanel: (): Promise<LoadedPanelModuleValue> => mocks.loadPanel(),
}));

vi.mock('./panel/GlobalSearchPanel', async () => {
  const { createElement } = await import('react');

  return {
    GlobalSearchPanel: (props: SearchPanelProps): ReactElement => createElement(FakePanel, props),
  };
});

const LISTING_ID = 'b0000001-0000-4000-8000-000000000001';
const LISTING_PATH = `/listings/${LISTING_ID}`;
const CATALOG_PATH = '/catalog';
const QUERY = 'теплый';
const OTHER_ORGANIZATION_ID = 'f0000001-0000-4000-8000-0000000000ff';

const LOAD_ERROR_MESSAGE = defaultLocaleCatalog['search.loadError.message'];
const LOAD_ERROR_REPEATED = defaultLocaleCatalog['search.loadError.repeated'];
const RETRY_NAME = defaultLocaleCatalog['common.retry'];

const FakePanel = ({ commandsRef, listboxId, onChoose, pendingChooseQuery, query }: SearchPanelProps): ReactElement => {
  useEffect(() => {
    commandsRef.current = { choose: (): void => undefined, move: (): void => undefined };

    return () => {
      commandsRef.current = null;
    };
  }, [commandsRef]);

  const handleChooseClick = (): void => {
    onChoose({ kind: 'object', object: { id: LISTING_ID, type: 'listing' } });
  };

  return (
    <div data-pending={pendingChooseQuery} data-testid="global-search-panel" id={listboxId} role="listbox">
      <button onClick={handleChooseClick} type="button">{query}</button>
    </div>
  );
};

const renderField = async ({ gate, rejectedLoadCount = 0 }: RenderFieldOptionsValue = {}): Promise<RenderedFieldValue> => {
  vi.resetModules();

  const [
    { ApiRuntimeProvider },
    { createTestRuntime },
    { withTestLocalizer },
    { RoutingProvider },
    { createMemoryLocation },
    { GlobalSearchField },
    { SearchController },
  ] = await Promise.all([
    import('@/shared/api'),
    import('@/shared/api/index.testing'),
    import('@/shared/i18n/index.testing'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('./GlobalSearchField'),
    import('./panel/SearchController'),
  ]);

  let rejectedCount = 0;

  mocks.loadPanel.mockImplementation(async () => {
    await gate;

    if (rejectedCount < rejectedLoadCount) {
      rejectedCount += 1;

      throw new Error('the panel chunk is unavailable');
    }

    return { requestGlobalSearchTexts: (): void => undefined, SearchController };
  });

  const location = createMemoryLocation(CATALOG_PATH);
  const runtime = createTestRuntime();
  const onPhoneFieldOpenChange = vi.fn<(isOpen: boolean) => void>();

  render(withTestLocalizer(
    <ApiRuntimeProvider runtime={runtime}>
      <RoutingProvider location={location}>
        <GlobalSearchField isPhoneFieldOpen={false} onPhoneFieldOpenChange={onPhoneFieldOpenChange} />
      </RoutingProvider>
    </ApiRuntimeProvider>,
  ));

  return { actingContext: runtime.actingContext, location, onPhoneFieldOpenChange };
};

const getInput = (): HTMLInputElement => {
  const input = screen.getByTestId('global-search-input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The search input is not an input');
  }

  return input;
};

const focusInput = (): void => {
  act(() => {
    getInput().focus();
  });
};

const typeQuery = (value: string): void => {
  fireEvent.input(getInput(), { target: { value } });
};

const openPanelWithQuery = async (): Promise<HTMLElement> => {
  focusInput();
  typeQuery(QUERY);

  return screen.findByTestId('global-search-panel');
};

describe('GlobalSearchField', () => {
  afterEach(() => {
    cleanup();
    mocks.loadPanel.mockReset();
  });

  it('loads the panel on focus and ties the field to the listbox it opens', async () => {
    await renderField();
    const input = getInput();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toBeNull();

    focusInput();
    const panel = await screen.findByTestId('global-search-panel');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('closes the panel and clears the text, and a blocked choice leaves the address as it is', async () => {
    const { location, onPhoneFieldOpenChange } = await renderField();
    const onBlocked = vi.fn();
    location.block(onBlocked);
    const panel = await openPanelWithQuery();

    fireEvent.click(panel.querySelector('button') ?? panel);

    expect(onBlocked).toHaveBeenCalledOnce();
    expect(location.read().path).toBe(CATALOG_PATH);
    expect(screen.queryByTestId('global-search-panel')).toBeNull();
    expect(getInput().value).toBe('');
    expect(onPhoneFieldOpenChange).toHaveBeenCalledWith(false);
  });

  it('moves to the chosen address and asks the destination for focus when nothing blocks', async () => {
    const { location } = await renderField();
    const panel = await openPanelWithQuery();

    fireEvent.click(panel.querySelector('button') ?? panel);

    expect(location.read().path).toBe(LISTING_PATH);
    expect(location.read().focusRequest).toBe(1);
    expect(screen.queryByTestId('global-search-panel')).toBeNull();
    expect(getInput().value).toBe('');
  });

  it('hands an Enter pressed before the panel arrived to it as a pending choice of the same text', async () => {
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    await renderField({ gate });
    focusInput();
    typeQuery(QUERY);

    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(screen.queryByTestId('global-search-panel')).toBeNull();

    await act(async () => {
      openGate();
      await gate;
    });

    const panel = await screen.findByTestId('global-search-panel');

    expect(panel.getAttribute('data-pending')).toBe(QUERY);
  });

  it('forgets the pending choice when the text changes', async () => {
    await renderField();
    const panel = await openPanelWithQuery();

    fireEvent.keyDown(getInput(), { key: 'Enter' });

    expect(panel.getAttribute('data-pending')).toBe(QUERY);

    typeQuery(`${QUERY} угол`);

    expect(panel.getAttribute('data-pending')).toBeNull();
  });

  it('starts over for the new organization: the text is cleared and the choice that waited is forgotten', async () => {
    const { actingContext } = await renderField();
    const panel = await openPanelWithQuery();
    fireEvent.keyDown(getInput(), { key: 'Enter' });

    expect(panel.getAttribute('data-pending')).toBe(QUERY);

    act(() => {
      actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: actingContext.get().userId });
    });

    expect(getInput().value).toBe('');
    expect(screen.getByTestId('global-search-panel').getAttribute('data-pending')).toBeNull();
    expect(screen.getByTestId('global-search-panel').textContent).toBe('');
  });

  it('clears the text on Escape pressed before the panel arrived, and the panel that arrives later stays closed', async () => {
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    await renderField({ gate });
    focusInput();
    typeQuery(QUERY);

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(getInput().value).toBe('');

    act(() => {
      getInput().blur();
    });
    await act(async () => {
      openGate();
      await gate;
    });

    expect(screen.queryByTestId('global-search-panel')).toBeNull();
  });

  it('keeps the text and closes the panel on the first Escape, then clears the text on the second', async () => {
    await renderField();
    await openPanelWithQuery();

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(screen.queryByTestId('global-search-panel')).toBeNull();
    expect(getInput().value).toBe(QUERY);

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(getInput().value).toBe('');
  });

  describe('when the panel does not load', () => {
    it('shows a retry after the first failure and the repeated message after the second', async () => {
      await renderField({ rejectedLoadCount: 2 });

      focusInput();
      const notice = await screen.findByRole('alert');

      expect(notice.textContent).toContain(LOAD_ERROR_MESSAGE);

      fireEvent.click(screen.getByRole('button', { name: RETRY_NAME }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(LOAD_ERROR_REPEATED);
      });
      expect(screen.getByRole('button', { name: RETRY_NAME })).toBeDefined();
    });

    it('opens the panel after a successful retry and keeps the text', async () => {
      await renderField({ rejectedLoadCount: 1 });
      focusInput();
      typeQuery(QUERY);
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: RETRY_NAME }));

      await screen.findByTestId('global-search-panel');

      expect(screen.queryByRole('alert')).toBeNull();
      expect(getInput().value).toBe(QUERY);
    });

    it('hides the notice on Escape', async () => {
      await renderField({ rejectedLoadCount: 1 });
      focusInput();
      await screen.findByRole('alert');

      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
