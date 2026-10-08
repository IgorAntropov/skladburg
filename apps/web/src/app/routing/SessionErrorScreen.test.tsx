import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import { SessionErrorScreen } from './SessionErrorScreen';

const SESSION_ERROR = new ConnectError('the engine is unavailable', Code.Unavailable);

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderScreen = async (isRetrying: boolean, onRetry: () => void = () => undefined): Promise<(isNextRetrying: boolean) => void> => {
  const localizer = await createTestLocalizer();
  const createScreen = (isCurrentRetrying: boolean): ReturnType<typeof SessionErrorScreen> => (
    <LocalizerProvider localizer={localizer}>
      <SessionErrorScreen error={SESSION_ERROR} isRetrying={isCurrentRetrying} onRetry={onRetry} />
    </LocalizerProvider>
  );
  const { rerender } = render(createScreen(isRetrying));

  return (isNextRetrying) => {
    rerender(createScreen(isNextRetrying));
  };
};

describe('SessionErrorScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the message by the code of the error as the heading and offers to retry', async () => {
    const onRetry = vi.fn();
    await renderScreen(false, onRetry);

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.unavailable']);
    expect(screen.getByRole('heading', { level: 1, name: defaultLocaleCatalog['error.unavailable'] })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps the same announcement and the focus on the button while the session loads again', async () => {
    const onRetry = vi.fn();
    const update = await renderScreen(false, onRetry);
    const alert = screen.getByRole('alert');
    const button = screen.getByRole('button');
    button.focus();

    update(true);

    expect(screen.getByRole('alert')).toBe(alert);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] })).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('announces the message again when the new attempt ends with the same error', async () => {
    const update = await renderScreen(false);
    const alert = screen.getByRole('alert');

    update(true);
    update(false);

    expect(screen.getByRole('alert')).not.toBe(alert);
    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.unavailable']);
  });
});
