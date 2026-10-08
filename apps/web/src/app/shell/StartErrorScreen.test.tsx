import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import { StartErrorScreen } from './StartErrorScreen';

const createTestLocalizer = (): ReturnType<typeof createLocalizer> => {
  const { defaultLocale } = defaultTenant;

  return createLocalizer({
    bundledLocales: [defaultLocale],
    catalogLoaders: { [defaultLocale]: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: [defaultLocale], defaultLocale, termOverrides: {} },
    userTimeZone: 'UTC',
  });
};

const renderScreen = async (onRetry: () => Promise<void>): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <StartErrorScreen onRetry={onRetry} />
    </LocalizerProvider>,
  );
};

const expectButtonEnabled = (): void => {
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
};

describe('StartErrorScreen', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('announces the failure with the text from the catalog', async () => {
    await renderScreen(() => Promise.resolve());

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['app.startError.message']);
  });

  it('offers an enabled retry button', async () => {
    await renderScreen(() => Promise.resolve());

    const button = screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] });

    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('retries once per click', async () => {
    const onRetry = vi.fn(() => Promise.resolve());
    await renderScreen(onRetry);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(expectButtonEnabled);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('disables the button and shows the progress text while retrying', async () => {
    let finishRetry: () => void = () => undefined;
    const retrying = new Promise<void>((resolve) => {
      finishRetry = resolve;
    });
    await renderScreen(() => retrying);

    fireEvent.click(screen.getByRole('button'));

    const button = screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retrying'] });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    finishRetry();

    await waitFor(expectButtonEnabled);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] })).toBeDefined();
  });
});
