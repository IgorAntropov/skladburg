import type {
  KeyboardEvent,
  ReactElement,
} from 'react';
import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IMemoryLocation } from '@/shared/routing/index.testing';

import type { SearchPanelProps } from '../../model/searchPanelTypes';

interface ControllerMocksValue {
  choose: Mock<() => void>;
  move: Mock<(step: -1 | 1) => void>;
}

interface HarnessCallbacksValue {
  onFieldExit: Mock<() => void>;
  onPendingChooseConsumed: Mock<() => void>;
  onPhoneFieldClose: Mock<() => void>;
  onQueryReset: Mock<() => void>;
}

interface HarnessProps {
  callbacks: HarnessCallbacksValue;
  initialQuery: string;
  isControllerShown: boolean;
  onReactKeyDown?: ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined;
  pendingChooseQuery?: string | undefined;
}

interface RenderControllerOptionsValue {
  initialQuery?: string | undefined;
  isFieldFocused?: boolean | undefined;
  onReactKeyDown?: ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined;
  pendingChooseQuery?: string | undefined;
}

interface RenderedControllerValue {
  callbacks: HarnessCallbacksValue;
  location: IMemoryLocation;
  unmount: () => void;
}

const mocks = vi.hoisted((): ControllerMocksValue => ({
  choose: vi.fn<() => void>(),
  move: vi.fn<(step: -1 | 1) => void>(),
}));

vi.mock('./GlobalSearchPanel', async () => {
  const { createElement } = await import('react');

  return {
    GlobalSearchPanel: (props: SearchPanelProps): ReactElement => createElement(FakePanel, props),
  };
});

const LISTING_ID = 'b0000001-0000-4000-8000-000000000001';
const LISTING_PATH = `/listings/${LISTING_ID}`;
const CATALOG_PATH = '/catalog';
const QUERY = 'теплый';
const FIRST_OPTION_ID = 'option-1';
const SECOND_OPTION_ID = 'option-2';

const FakePanel = ({
  commandsRef,
  listboxId,
  onActiveOptionChange,
  onChoose,
  onPendingChooseSettled,
  pendingChooseQuery,
}: SearchPanelProps): ReactElement => {
  useEffect(() => {
    commandsRef.current = { choose: mocks.choose, move: mocks.move };

    return () => {
      commandsRef.current = null;
    };
  }, [commandsRef]);

  const handleFirstClick = (): void => {
    onActiveOptionChange(FIRST_OPTION_ID);
  };

  const handleSecondClick = (): void => {
    onActiveOptionChange(SECOND_OPTION_ID);
  };

  const handleChooseClick = (): void => {
    onChoose({ kind: 'object', object: { id: LISTING_ID, type: 'listing' } });
  };

  const handleSettleClick = (): void => {
    onPendingChooseSettled();
  };

  return (
    <div data-pending={pendingChooseQuery} data-testid="panel" id={listboxId} role="listbox">
      <button data-testid="first" onClick={handleFirstClick} type="button" />
      <button data-testid="second" onClick={handleSecondClick} type="button" />
      <button data-testid="choose" onClick={handleChooseClick} type="button" />
      <button data-testid="settle" onClick={handleSettleClick} type="button" />
    </div>
  );
};

const createCallbacks = (): HarnessCallbacksValue => ({
  onFieldExit: vi.fn<() => void>(),
  onPendingChooseConsumed: vi.fn<() => void>(),
  onPhoneFieldClose: vi.fn<() => void>(),
  onQueryReset: vi.fn<() => void>(),
});

const renderController = async ({
  initialQuery = QUERY,
  isFieldFocused = true,
  onReactKeyDown,
  pendingChooseQuery,
}: RenderControllerOptionsValue = {}): Promise<RenderedControllerValue> => {
  vi.resetModules();

  const [
    { ApiRuntimeProvider },
    { createTestRuntime, TEST_ORGANIZATION_ID },
    { RoutingProvider },
    { createMemoryLocation },
    { SearchController },
  ] = await Promise.all([
    import('@/shared/api'),
    import('@/shared/api/index.testing'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('./SearchController'),
  ]);

  const Harness = (props: HarnessProps): ReactElement => {
    const { callbacks, initialQuery: startQuery, isControllerShown, pendingChooseQuery: pending } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState(startQuery);

    return (
      <div>
        <button data-testid="outside" type="button" />
        <div onKeyDown={onReactKeyDown} ref={rootRef}>
          <input
            aria-expanded="false"
            data-testid="input"
            onChange={(event): void => {
              setQuery(event.target.value);
            }}
            ref={inputRef}
            role="combobox"
            value={query}
          />
          <button data-testid="inside" type="button" />
          {isControllerShown && (
            <SearchController
              inputRef={inputRef}
              onFieldExit={callbacks.onFieldExit}
              onPendingChooseConsumed={callbacks.onPendingChooseConsumed}
              onPhoneFieldClose={callbacks.onPhoneFieldClose}
              onQueryReset={callbacks.onQueryReset}
              organizationId={TEST_ORGANIZATION_ID}
              pendingChooseQuery={pending}
              query={query}
              rootRef={rootRef}
            />
          )}
        </div>
      </div>
    );
  };

  const callbacks = createCallbacks();
  const location = createMemoryLocation(CATALOG_PATH);
  const runtime = createTestRuntime();

  const renderHarness = (isControllerShown: boolean): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <RoutingProvider location={location}>
        <Harness
          callbacks={callbacks}
          initialQuery={initialQuery}
          isControllerShown={isControllerShown}
          pendingChooseQuery={pendingChooseQuery}
        />
      </RoutingProvider>
    </ApiRuntimeProvider>
  );

  const { rerender, unmount } = render(renderHarness(false));

  if (isFieldFocused) {
    act(() => {
      getInput().focus();
    });
  }

  rerender(renderHarness(true));

  return { callbacks, location, unmount };
};

const getInput = (): HTMLInputElement => {
  const input = screen.getByTestId('input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The search input is not an input');
  }

  return input;
};

const clickButton = (name: string): void => {
  fireEvent.click(screen.getByTestId(name));
};

describe('SearchController', () => {
  afterEach(() => {
    cleanup();
    mocks.choose.mockReset();
    mocks.move.mockReset();
  });

  describe('combobox attributes of the input', () => {
    it('sets them while the panel is open, follows the active option and removes them when the panel closes', async () => {
      await renderController();
      const input = getInput();
      const panel = screen.getByTestId('panel');

      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(input.getAttribute('aria-controls')).toBe(panel.id);
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(input.getAttribute('aria-activedescendant')).toBeNull();

      clickButton('first');

      expect(input.getAttribute('aria-activedescendant')).toBe(FIRST_OPTION_ID);

      clickButton('second');

      expect(input.getAttribute('aria-activedescendant')).toBe(SECOND_OPTION_ID);

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByTestId('panel')).toBeNull();
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('aria-controls')).toBeNull();
      expect(input.getAttribute('aria-autocomplete')).toBeNull();
      expect(input.getAttribute('aria-activedescendant')).toBeNull();
    });

    it('removes them when the controller goes away with the panel open', async () => {
      const { unmount } = await renderController();
      const input = getInput();
      clickButton('first');

      unmount();

      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('aria-controls')).toBeNull();
      expect(input.getAttribute('aria-autocomplete')).toBeNull();
      expect(input.getAttribute('aria-activedescendant')).toBeNull();
    });

    it('leaves the input as it was while the field is not focused', async () => {
      await renderController({ isFieldFocused: false });
      const input = getInput();

      expect(screen.queryByTestId('panel')).toBeNull();
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('aria-controls')).toBeNull();
    });
  });

  describe('keys', () => {
    it('hands the arrows to the open panel and stops the caret from moving', async () => {
      await renderController();

      expect(fireEvent.keyDown(getInput(), { key: 'ArrowDown' })).toBe(false);
      expect(fireEvent.keyDown(getInput(), { key: 'ArrowUp' })).toBe(false);

      expect(mocks.move).toHaveBeenNthCalledWith(1, 1);
      expect(mocks.move).toHaveBeenNthCalledWith(2, -1);
    });

    it('opens the closed panel on an arrow key instead of moving', async () => {
      await renderController({ isFieldFocused: false });

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' });

      expect(screen.getByTestId('panel')).toBeDefined();
      expect(mocks.move).not.toHaveBeenCalled();
    });

    it('chooses on Enter when the panel has an active option', async () => {
      await renderController();
      clickButton('first');

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(mocks.choose).toHaveBeenCalledOnce();
      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBeNull();
    });

    it('waits for the answer on Enter when there is no active option yet', async () => {
      await renderController();

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(mocks.choose).not.toHaveBeenCalled();
      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBe(QUERY);
    });

    it('does nothing on Enter for an empty text', async () => {
      await renderController({ initialQuery: '' });

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(mocks.choose).not.toHaveBeenCalled();
      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBeNull();
    });

    it('ignores keys while a composition is going', async () => {
      await renderController();

      expect(fireEvent.keyDown(getInput(), { isComposing: true, key: 'Escape' })).toBe(true);

      expect(screen.getByTestId('panel')).toBeDefined();
    });

    it('closes the panel on the first Escape and leaves the field on the second', async () => {
      const { callbacks } = await renderController();

      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(screen.queryByTestId('panel')).toBeNull();
      expect(callbacks.onFieldExit).not.toHaveBeenCalled();

      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(callbacks.onFieldExit).toHaveBeenCalledOnce();
    });

    it('handles the keys before the handlers React delegates to the root', async () => {
      const seen: boolean[] = [];
      await renderController({
        onReactKeyDown: (event): void => {
          seen.push(event.defaultPrevented);
        },
      });

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      fireEvent.keyDown(getInput(), { key: 'Enter' });
      fireEvent.keyDown(getInput(), { key: 'Escape' });
      fireEvent.keyDown(getInput(), { key: 'a' });

      expect(seen).toEqual([true, true, true, false]);
    });
  });

  describe('opening and closing', () => {
    it('opens on typing and on a click, and closes when focus leaves the field', async () => {
      await renderController({ isFieldFocused: false });
      const input = getInput();

      fireEvent.input(input, { target: { value: `${QUERY} у` } });

      expect(screen.getByTestId('panel')).toBeDefined();

      act(() => {
        input.focus();
        input.blur();
      });

      expect(screen.queryByTestId('panel')).toBeNull();

      fireEvent.click(input);

      expect(screen.getByTestId('panel')).toBeDefined();
    });

    it('stays open when focus moves to something inside the field', async () => {
      await renderController();

      fireEvent.blur(getInput(), { relatedTarget: screen.getByTestId('inside') });

      expect(screen.getByTestId('panel')).toBeDefined();
    });

    it('closes when focus moves outside the field or nowhere', async () => {
      await renderController();

      fireEvent.blur(getInput(), { relatedTarget: screen.getByTestId('outside') });

      expect(screen.queryByTestId('panel')).toBeNull();

      fireEvent.click(getInput());
      fireEvent.blur(getInput(), { relatedTarget: null });

      expect(screen.queryByTestId('panel')).toBeNull();
    });
  });

  describe('a pending choice', () => {
    it('takes the choice over, opens the panel for it and tells the field it is taken', async () => {
      const { callbacks } = await renderController({ isFieldFocused: false, pendingChooseQuery: QUERY });

      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBe(QUERY);
      expect(callbacks.onPendingChooseConsumed).toHaveBeenCalledOnce();
    });

    it('forgets the choice when the panel settles it and when the text changes', async () => {
      await renderController({ pendingChooseQuery: QUERY });

      clickButton('settle');

      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBeNull();

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBe(QUERY);

      fireEvent.input(getInput(), { target: { value: `${QUERY} у` } });

      expect(screen.getByTestId('panel').getAttribute('data-pending')).toBeNull();
    });
  });

  describe('a choice', () => {
    it('closes the panel, clears the text and the phone field, then moves to the address and asks for focus', async () => {
      const { callbacks, location } = await renderController();

      clickButton('choose');

      expect(screen.queryByTestId('panel')).toBeNull();
      expect(callbacks.onQueryReset).toHaveBeenCalledOnce();
      expect(callbacks.onPhoneFieldClose).toHaveBeenCalledOnce();
      expect(location.read().path).toBe(LISTING_PATH);
      expect(location.read().focusRequest).toBe(1);
    });

    it('leaves the address as it is when something blocks the move, and the panel is still closed', async () => {
      const { callbacks, location } = await renderController();
      const onBlocked = vi.fn();
      location.block(onBlocked);

      clickButton('choose');

      expect(onBlocked).toHaveBeenCalledOnce();
      expect(location.read().path).toBe(CATALOG_PATH);
      expect(screen.queryByTestId('panel')).toBeNull();
      expect(callbacks.onQueryReset).toHaveBeenCalledOnce();
    });
  });
});
