import type { ReactElement } from 'react';

import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { UnreadCountReporter } from './UnreadCountReporter';

vi.mock('./loadUnreadCountReporter', () => ({
  loadUnreadCountReporter: (): Promise<{ UnreadCountReporterBody: () => ReactElement }> => Promise.resolve({
    UnreadCountReporterBody: (): ReactElement => <span data-testid="reporter-body" />,
  }),
}));

describe('UnreadCountReporter', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing until the chunk is loaded and then renders the reporter body', async () => {
    render(<UnreadCountReporter />);

    expect(screen.queryByTestId('reporter-body')).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('reporter-body')).toBeDefined();
    });
  });
});
