import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useRef } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NotificationCloseReasonValue } from './notificationCloseReason';

import { useNotificationDismiss } from './useNotificationDismiss';

type DismissMock = Mock<(reason: NotificationCloseReasonValue) => void>;

const renderDismiss = (): DismissMock => {
  const onDismiss: DismissMock = vi.fn<(reason: NotificationCloseReasonValue) => void>();

  const Harness = (): ReactElement => {
    const anchorRef = useRef<HTMLDivElement>(null);

    useNotificationDismiss({ anchorRef, onDismiss });

    return (
      <div>
        <div ref={anchorRef}>
          <button data-testid="inside" type="button" />
        </div>
        <button data-testid="outside" type="button" />
      </div>
    );
  };

  render(<Harness />);

  return onDismiss;
};

describe('useNotificationDismiss', () => {
  afterEach(() => {
    cleanup();
  });

  it('dismisses with the escape reason on Escape', () => {
    const onDismiss = renderDismiss();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('escape');
  });

  it('ignores other keys and an Escape that someone already handled', () => {
    const onDismiss = renderDismiss();
    const handledEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' });

    handledEvent.preventDefault();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    document.body.dispatchEvent(handledEvent);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on a press outside of the anchor', () => {
    const onDismiss = renderDismiss();

    fireEvent.pointerDown(screen.getByTestId('outside'));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('outside');
  });

  it('dismisses when focus leaves for something outside of the anchor', () => {
    const onDismiss = renderDismiss();

    screen.getByTestId('outside').focus();

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('outside');
  });

  it('keeps the panel for a press and focus inside of the anchor', () => {
    const onDismiss = renderDismiss();
    const inside = screen.getByTestId('inside');

    fireEvent.pointerDown(inside);
    inside.focus();

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
