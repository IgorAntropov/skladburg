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
  const button = screen.getByRole('button');

  expect(button.hasAttribute('disabled')).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBeNull();
  expect(button.getAttribute('aria-busy')).toBeNull();
};

const createDeferredRetry = (): { finish: () => void; promise: Promise<void> } => {
  let finish: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });

  return { finish, promise };
};

describe('StartErrorScreen', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('announces the failure with the text from the catalog as the heading of the screen', async () => {
    await renderScreen(() => Promise.resolve());

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(screen.getByRole('heading', { level: 1, name: defaultLocaleCatalog['app.startError.message'] })).toBeDefined();
    expect(screen.getByRole('main')).toBeDefined();
  });

  it('offers an enabled retry button with the common text', async () => {
    await renderScreen(() => Promise.resolve());

    const button = screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] });

    expect(button.getAttribute('type')).toBe('button');
    expectButtonEnabled();
  });

  it('retries once per click', async () => {
    const onRetry = vi.fn(() => Promise.resolve());
    await renderScreen(onRetry);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(expectButtonEnabled);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the progress text, ignores further clicks and keeps the focus on the button while retrying', async () => {
    const onRetry = vi.fn();
    const deferred = createDeferredRetry();
    onRetry.mockReturnValue(deferred.promise);
    await renderScreen(onRetry);
    screen.getByRole('button').focus();

    fireEvent.click(screen.getByRole('button'));

    const button = screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledOnce();

    deferred.finish();

    await waitFor(expectButtonEnabled);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('announces the same failure again after an attempt that ends on the same screen', async () => {
    await renderScreen(() => Promise.resolve());
    const firstAlert = screen.getByRole('alert');

    fireEvent.click(screen.getByRole('button'));

    await waitFor(expectButtonEnabled);
    expect(screen.getByRole('alert')).not.toBe(firstAlert);
    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['app.startError.message']);
  });
});
