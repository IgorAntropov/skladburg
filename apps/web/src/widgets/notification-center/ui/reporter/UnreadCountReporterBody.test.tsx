import {
  cleanup,
  render,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { UnreadCountSinkContext } from '../../lib/unreadCountSink';
import { UnreadCountReporterBody } from './UnreadCountReporterBody';

interface ReporterMocksValue {
  unreadCount: number | undefined;
}

const mocks = vi.hoisted((): ReporterMocksValue => ({ unreadCount: undefined }));

vi.mock('@/entities/notification', () => ({
  useUnreadNotificationCount: (): { data: number | undefined } => ({ data: mocks.unreadCount }),
}));

describe('UnreadCountReporterBody', () => {
  afterEach(() => {
    cleanup();
    mocks.unreadCount = undefined;
  });

  it('reports the number of unread notifications and its changes', () => {
    const report = vi.fn();
    mocks.unreadCount = 3;

    const { rerender } = render(
      <UnreadCountSinkContext value={report}><UnreadCountReporterBody /></UnreadCountSinkContext>,
    );

    expect(report).toHaveBeenLastCalledWith(3);

    mocks.unreadCount = 2;
    rerender(<UnreadCountSinkContext value={report}><UnreadCountReporterBody /></UnreadCountSinkContext>);

    expect(report).toHaveBeenLastCalledWith(2);
  });

  it('reports zero while the number is not loaded yet', () => {
    const report = vi.fn();

    render(<UnreadCountSinkContext value={report}><UnreadCountReporterBody /></UnreadCountSinkContext>);

    expect(report).toHaveBeenLastCalledWith(0);
  });

  it('takes the number back when it unmounts', () => {
    const report = vi.fn();
    mocks.unreadCount = 5;

    const { unmount } = render(
      <UnreadCountSinkContext value={report}><UnreadCountReporterBody /></UnreadCountSinkContext>,
    );
    unmount();

    expect(report).toHaveBeenLastCalledWith(0);
  });
});
