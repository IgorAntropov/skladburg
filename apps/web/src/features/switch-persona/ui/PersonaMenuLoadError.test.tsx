import type { ReactElement } from 'react';

import { QueryClient } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createTestRuntime } from '@/shared/api/index.testing';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';

import {
  createPersonaTestLocalizer,
  PersonaProviders,
} from '../lib/testing/personaTestHarness';
import { PersonaMenuLoadError } from './PersonaMenuLoadError';

const MENU_LABEL = 'Profile';
const MENU_BUTTON_NAME = 'Menu';
const RETRY_NAME = defaultLocaleCatalog['persona.loadError.retry'];
const LOAD_ERROR_STATUS = defaultLocaleCatalog['persona.loadError.status'];
const LOADED_ITEM_NAME = 'First persona';
const LOADING_TEXT = defaultLocaleCatalog['persona.loading'];

type LoadStateValue = 'error' | 'loaded' | 'loading';

interface MenuProps {
  onRetry: () => void;
}

const MENU_ITEMS_BY_STATE: Record<LoadStateValue, (onRetry: () => void) => ReactElement> = {
  error: onRetry => <PersonaMenuLoadError onRetry={onRetry} />,
  loaded: () => <DropdownMenuItem onSelect={vi.fn()}>{LOADED_ITEM_NAME}</DropdownMenuItem>,
  loading: () => <p>{LOADING_TEXT}</p>,
};

const Menu = ({ onRetry }: MenuProps): ReactElement => (
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button>{MENU_BUTTON_NAME}</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent label={MENU_LABEL}>
      <PersonaMenuLoadError onRetry={onRetry} />
    </DropdownMenuContent>
  </DropdownMenu>
);

const RetryFlowMenu = (): ReactElement => {
  const [state, setState] = useState<LoadStateValue>('error');

  const handleRetry = (): void => {
    setState('loading');
    window.setTimeout(() => {
      setState('loaded');
    }, 0);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>{MENU_BUTTON_NAME}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent label={MENU_LABEL}>
        {MENU_ITEMS_BY_STATE[state](handleRetry)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const renderInProviders = async (children: ReactElement): Promise<void> => {
  const localizer = await createPersonaTestLocalizer();

  render(
    <PersonaProviders localizer={localizer} queryClient={new QueryClient()} runtime={createTestRuntime()}>
      {children}
    </PersonaProviders>,
  );
};

const openMenu = async (): Promise<HTMLElement> => {
  const trigger = screen.getByRole('button', { name: MENU_BUTTON_NAME });

  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });

  return screen.findByRole('menu', { name: MENU_LABEL });
};

describe('PersonaMenuLoadError', () => {
  afterEach(() => {
    cleanup();
  });

  it('offers the retry item and announces the failure', async () => {
    await renderInProviders(<Menu onRetry={vi.fn()} />);
    await openMenu();

    expect(await screen.findByRole('menuitem', { name: RETRY_NAME })).toBeDefined();
    await waitFor(() => {
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(LOAD_ERROR_STATUS);
    });
  });

  it('asks for the list again on Enter, keeps the menu open and keeps the focus inside the menu', async () => {
    const onRetry = vi.fn();
    await renderInProviders(<Menu onRetry={onRetry} />);
    const menu = await openMenu();
    const retry = await screen.findByRole('menuitem', { name: RETRY_NAME });

    retry.focus();
    fireEvent.keyDown(retry, { key: 'Enter' });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBe(menu);
    expect(menu.contains(document.activeElement)).toBe(true);
  });

  it('asks for the list again on a click and keeps the menu open', async () => {
    const onRetry = vi.fn();
    await renderInProviders(<Menu onRetry={onRetry} />);
    const menu = await openMenu();

    fireEvent.click(await screen.findByRole('menuitem', { name: RETRY_NAME }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBe(menu);
    expect(menu.contains(document.activeElement)).toBe(true);
  });

  it('keeps the focus in the menu while the item is replaced by the loaded list and lets the arrow key reach the first item', async () => {
    await renderInProviders(<RetryFlowMenu />);
    const menu = await openMenu();
    const retry = await screen.findByRole('menuitem', { name: RETRY_NAME });

    retry.focus();
    fireEvent.keyDown(retry, { key: 'Enter' });

    expect(screen.queryByRole('menuitem', { name: RETRY_NAME })).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(menu);
    });

    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 5);
      });
    });
    const firstPersona = await screen.findByRole('menuitem', { name: LOADED_ITEM_NAME });

    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBe(menu);
    expect(document.activeElement).toBe(menu);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(document.activeElement).toBe(firstPersona);
    });
  });
});
