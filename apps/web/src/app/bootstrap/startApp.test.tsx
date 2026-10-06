import {
  cleanup,
  fireEvent,
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

import type { AppContextValue } from './loadAppContext';

import { loadAppContext } from './loadAppContext';
import { startApp } from './startApp';

vi.mock('./loadAppContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('./loadAppContext')>();

  return { loadAppContext: vi.fn(original.loadAppContext) };
});

const createRootElement = (): HTMLElement => {
  const rootElement = document.createElement('div');

  document.body.append(rootElement);

  return rootElement;
};

const expectButtonEnabled = (): void => {
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
};

describe('startApp', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders the application after the context is loaded', async () => {
    await startApp(createRootElement());

    expect(await screen.findByRole('main')).toBeDefined();
  });

  it('reports a loading failure to the console and renders the start error screen', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(loadAppContext).mockRejectedValueOnce(new Error('catalog chunk is unavailable'));

    await startApp(createRootElement());

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> startApp -> tryRenderApp:');
    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] })).toBeDefined();
  });

  it('renders the application in the same root after a successful retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(loadAppContext).mockRejectedValueOnce(new Error('catalog chunk is unavailable'));
    const rootElement = createRootElement();

    await startApp(rootElement);
    fireEvent.click(await screen.findByRole('button'));

    expect(await screen.findByRole('heading', { name: defaultTenant.brandName })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(rootElement.querySelector('main')).not.toBeNull();
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });

  it('keeps the start error screen and re-enables the button after a failed retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const expectErrorLoggedTwice = (): void => {
      expect(consoleError).toHaveBeenCalledTimes(2);
    };
    vi.mocked(loadAppContext)
      .mockRejectedValueOnce(new Error('catalog chunk is unavailable'))
      .mockRejectedValueOnce(new Error('still unavailable'));

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));

    await waitFor(expectErrorLoggedTwice);
    await waitFor(expectButtonEnabled);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] })).toBeDefined();
    expect(consoleError.mock.calls[1]?.[0]).toBe('> startApp -> tryRenderApp:');
  });

  it('shows the progress state while the retry is loading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let failRetry: (reason: Error) => void = () => undefined;
    const retrying = new Promise<AppContextValue>((_resolve, reject) => {
      failRetry = reject;
    });
    vi.mocked(loadAppContext)
      .mockRejectedValueOnce(new Error('catalog chunk is unavailable'))
      .mockReturnValueOnce(retrying);

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));

    const button = await screen.findByRole('button', { name: defaultLocaleCatalog['app.startError.retrying'] });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    failRetry(new Error('still unavailable'));

    await waitFor(expectButtonEnabled);
  });
});
