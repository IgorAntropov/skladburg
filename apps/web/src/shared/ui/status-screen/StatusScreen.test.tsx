import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { StatusScreen } from './StatusScreen';

const TITLE = 'Something went wrong';
const DESCRIPTION = 'Check the connection and try again';
const ACTION_TEXT = 'Try again';

describe('StatusScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the title as the first level heading', () => {
    render(<StatusScreen layout="section" title={TITLE} tone="neutral" />);

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
  });

  it('does not announce a neutral screen', () => {
    render(<StatusScreen layout="section" title={TITLE} tone="neutral" />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the title of an error screen and keeps it a heading', () => {
    render(<StatusScreen layout="section" title={TITLE} tone="error" />);

    expect(screen.getByRole('alert').textContent).toBe(TITLE);
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeTruthy();
  });

  it('shows the description and the action when they are given', () => {
    render(
      <StatusScreen
        action={<a href="#retry">{ACTION_TEXT}</a>}
        description={DESCRIPTION}
        layout="section"
        title={TITLE}
        tone="error"
      />,
    );

    expect(screen.getByText(DESCRIPTION)).toBeTruthy();
    expect(screen.getByRole('link', { name: ACTION_TEXT })).toBeTruthy();
  });

  it('omits the description when there is none', () => {
    const { container } = render(<StatusScreen layout="section" title={TITLE} tone="neutral" />);

    expect(container.querySelector('p')).toBeNull();
  });

  it('is the main landmark of the page in the app layout', () => {
    render(<StatusScreen layout="app" title={TITLE} tone="neutral" />);

    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('has no landmark of its own in the section layout, which lives inside the main of the section', () => {
    render(<StatusScreen layout="section" title={TITLE} tone="neutral" />);

    expect(screen.queryByRole('main')).toBeNull();
  });

  it('announces an error screen in the app layout and shows the action', () => {
    render(
      <StatusScreen
        action={<a href="#retry">{ACTION_TEXT}</a>}
        layout="app"
        title={TITLE}
        tone="error"
      />,
    );

    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(TITLE);
    expect(screen.getByRole('link', { name: ACTION_TEXT })).toBeTruthy();
  });

  it('does not announce a neutral screen even when it has an announce key', () => {
    render(<StatusScreen announceKey={1} layout="section" title={TITLE} tone="neutral" />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('replaces the alert node when the announce key changes', () => {
    const { rerender } = render(<StatusScreen announceKey={1} layout="section" title={TITLE} tone="error" />);
    const first = screen.getByRole('alert');

    rerender(<StatusScreen announceKey={2} layout="section" title={TITLE} tone="error" />);

    expect(screen.getByRole('alert')).not.toBe(first);
  });

  it('keeps the alert node while the announce key stays', () => {
    const { rerender } = render(<StatusScreen announceKey={1} layout="section" title={TITLE} tone="error" />);
    const first = screen.getByRole('alert');

    rerender(<StatusScreen announceKey={1} description={DESCRIPTION} layout="section" title={TITLE} tone="error" />);

    expect(screen.getByRole('alert')).toBe(first);
  });
});
