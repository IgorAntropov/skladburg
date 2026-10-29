import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TopBarProps } from '@/widgets/top-bar';

import { AppTopBar } from './AppTopBar';

interface AppTopBarMocksValue {
  cancelIdle: Mock<() => void>;
  scheduleIdle: Mock<(task: () => void) => () => void>;
}

const mocks = vi.hoisted((): AppTopBarMocksValue => ({
  cancelIdle: vi.fn<() => void>(),
  scheduleIdle: vi.fn<(task: () => void) => () => void>(),
}));

vi.mock('../lib/scheduleWhenIdle', () => ({
  scheduleWhenIdle: (task: () => void): (() => void) => mocks.scheduleIdle(task),
}));

vi.mock('../access', () => ({
  useAvailableSections: (): { kind: 'loading' } => ({ kind: 'loading' }),
}));

vi.mock('@/shared/routing', () => ({
  getAddressSection: (): undefined => undefined,
  useAddress: (): { address: undefined } => ({ address: undefined }),
}));

vi.mock('@/entities/session', () => ({
  useProfileSummary: (): { kind: 'pending' } => ({ kind: 'pending' }),
}));

vi.mock('@/widgets/support-chat', () => ({
  SupportChatLauncher: (): null => null,
}));

vi.mock('@/features/collapse-hud-panels', () => ({
  CollapseHudPanelsButton: (): null => null,
}));

vi.mock('@/widgets/profile-menu', () => ({
  ProfileMenuLauncher: (): null => null,
}));

vi.mock('@/widgets/top-bar', () => ({
  TopBar: ({ assistant }: TopBarProps): ReactElement => <div>{assistant}</div>,
}));

vi.mock('@/widgets/notification-center', () => ({
  NotificationCenterLauncher: ({ unreadCountReporter }: { unreadCountReporter?: ReactNode }): ReactElement => (
    <div data-testid="launcher">{unreadCountReporter}</div>
  ),
  UnreadCountReporter: (): ReactElement => <span data-testid="reporter" />,
}));

describe('AppTopBar', () => {
  beforeEach(() => {
    mocks.scheduleIdle.mockReturnValue(mocks.cancelIdle);
  });

  afterEach(() => {
    cleanup();
    mocks.scheduleIdle.mockReset();
    mocks.cancelIdle.mockReset();
  });

  it('does not mount the unread count reporter before the browser is idle', () => {
    render(<AppTopBar />);

    expect(screen.getByTestId('launcher')).toBeDefined();
    expect(screen.queryByTestId('reporter')).toBeNull();
    expect(mocks.scheduleIdle).toHaveBeenCalledOnce();
  });

  it('mounts the reporter into the launcher once the idle task runs', () => {
    render(<AppTopBar />);

    const [idleTask] = mocks.scheduleIdle.mock.lastCall ?? [];
    act(() => {
      idleTask?.();
    });

    expect(screen.getByTestId('launcher').contains(screen.getByTestId('reporter'))).toBe(true);
  });

  it('cancels the idle task when it unmounts before the browser is idle', () => {
    const { unmount } = render(<AppTopBar />);

    unmount();

    expect(mocks.cancelIdle).toHaveBeenCalledOnce();
  });
});
