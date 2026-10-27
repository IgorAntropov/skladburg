import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NotificationCloseReasonValue } from '../lib/notificationCloseReason';
import type { NotificationCenterPanelProps } from './panel/NotificationCenterPanel';

interface LauncherMocksValue {
  loadPanel: Mock<() => Promise<LoadedPanelModuleValue>>;
}

type LoadedPanelModuleValue = Awaited<ReturnType<typeof import('./loadNotificationCenterPanel').loadNotificationCenterPanel>>;

const mocks = vi.hoisted((): LauncherMocksValue => ({
  loadPanel: vi.fn<() => Promise<LoadedPanelModuleValue>>(),
}));

vi.mock('@/entities/assistant', () => ({
  AssistantPortrait: (): null => null,
}));

vi.mock('./loadNotificationCenterPanel', () => ({
  loadNotificationCenterPanel: (): Promise<LoadedPanelModuleValue> => mocks.loadPanel(),
}));

const BUTTON_NAME = defaultLocaleCatalog['hud.notifications.button'];
const LOAD_ERROR_MESSAGE = defaultLocaleCatalog['hud.notifications.loadError'];
const RETRY_NAME = defaultLocaleCatalog['common.retry'];

const CLOSE_REASONS: readonly NotificationCloseReasonValue[] = ['escape', 'link', 'outside'];

const FakePanel = ({ id, onClose }: NotificationCenterPanelProps): ReactElement => {
  return (
    <div data-testid="fake-panel" id={id}>
      {CLOSE_REASONS.map(reason => (
        <button data-testid={`close-${reason}`} key={reason} onClick={() => { onClose(reason); }} type="button" />
      ))}
    </div>
  );
};

const LOADED_PANEL_MODULE: LoadedPanelModuleValue = {
  isNotificationTextsReady: (): boolean => true,
  loadNotificationTexts: (): Promise<void> => Promise.resolve(),
  NotificationCenterPanel: FakePanel,
  requestNotificationTexts: (): void => undefined,
};

type TestingLibraryValue = typeof import('@testing-library/react');

let renderedLibrary: TestingLibraryValue | undefined;

const renderLauncher = async (unreadCount: number | undefined): Promise<TestingLibraryValue> => {
  vi.resetModules();

  const [react, testingLibrary, { withTestLocalizer }, { NotificationCenterLauncher }, { useReportUnreadCount }] = await Promise.all([
    import('react'),
    import('@testing-library/react'),
    import('@/shared/i18n/index.testing'),
    import('./NotificationCenterLauncher'),
    import('../lib/unreadCountSink'),
  ]);

  const FakeReporter = (): null => {
    const reportUnreadCount = useReportUnreadCount();

    react.useEffect(() => {
      reportUnreadCount(unreadCount ?? 0);
    }, [reportUnreadCount]);

    return null;
  };

  renderedLibrary = testingLibrary;
  testingLibrary.render(withTestLocalizer(
    <NotificationCenterLauncher unreadCountReporter={unreadCount === undefined ? undefined : <FakeReporter />} />,
  ));

  return testingLibrary;
};

describe('NotificationCenterLauncher', () => {
  afterEach(() => {
    renderedLibrary?.cleanup();
    renderedLibrary = undefined;
    mocks.loadPanel.mockReset();
  });

  it('keeps the plain name and no badge until a reporter hands over the number', async () => {
    const { screen } = await renderLauncher(undefined);

    expect(screen.getByRole('button', { name: BUTTON_NAME })).toBeDefined();
    expect(screen.queryByTestId('notification-center-badge')).toBeNull();
  });

  it('caps the badge at 99+ but keeps the real number in the name', async () => {
    const { screen } = await renderLauncher(120);

    expect(screen.getByRole('button', { name: 'Уведомления: 120 непрочитанных' })).toBeDefined();
    expect(screen.getByTestId('notification-center-badge').textContent).toBe('99+');
  });

  it('is busy while the chunk loads and then opens the panel it controls', async () => {
    let resolveLoad: (module: LoadedPanelModuleValue) => void = () => undefined;

    mocks.loadPanel.mockReturnValue(new Promise<LoadedPanelModuleValue>((resolve) => {
      resolveLoad = resolve;
    }));

    const { act, fireEvent, screen, waitFor } = await renderLauncher(0);
    const button = screen.getByRole('button', { name: BUTTON_NAME });

    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByTestId('fake-panel')).toBeNull();

    await act(async () => {
      resolveLoad(LOADED_PANEL_MODULE);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('fake-panel')).toBeDefined();
    });

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(screen.getByTestId('fake-panel').id);
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('closes the open panel with the next press of the button', async () => {
    mocks.loadPanel.mockResolvedValue(LOADED_PANEL_MODULE);

    const { fireEvent, screen, waitFor } = await renderLauncher(0);
    const button = screen.getByRole('button', { name: BUTTON_NAME });

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTestId('fake-panel')).toBeDefined();
    });

    fireEvent.click(button);

    expect(screen.queryByTestId('fake-panel')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it.each([
    ['escape', true],
    ['link', true],
    ['outside', false],
  ] as const)('closes the panel on %s and returns focus to the button only when it is %s', async (reason, isFocusReturned) => {
    mocks.loadPanel.mockResolvedValue(LOADED_PANEL_MODULE);

    const { fireEvent, screen, waitFor } = await renderLauncher(0);
    const button = screen.getByRole('button', { name: BUTTON_NAME });

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTestId('fake-panel')).toBeDefined();
    });
    document.body.focus();

    fireEvent.click(screen.getByTestId(`close-${reason}`));

    expect(screen.queryByTestId('fake-panel')).toBeNull();
    expect(document.activeElement === button).toBe(isFocusReturned);
  });

  it('shows the load error with a retry that loads the chunk again', async () => {
    mocks.loadPanel.mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue(LOADED_PANEL_MODULE);

    const { fireEvent, screen, waitFor } = await renderLauncher(0);

    fireEvent.click(screen.getByRole('button', { name: BUTTON_NAME }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(LOAD_ERROR_MESSAGE);
    });

    fireEvent.click(screen.getByRole('button', { name: RETRY_NAME }));

    await waitFor(() => {
      expect(screen.getByTestId('fake-panel')).toBeDefined();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
