import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useReplicaHold } from './useReplicaHold';

interface HarnessProps {
  onHold: () => void;
  onRelease: () => void;
}

const Harness = ({ onHold, onRelease }: HarnessProps): ReactElement => {
  const handlers = useReplicaHold({ onHold, onRelease });

  return (
    <>
      <div {...handlers} data-testid="bubble">
        <div data-testid="scroll-area" tabIndex={0} />
        <button data-testid="close" type="button" />
      </div>
      <button data-testid="outside" type="button" />
    </>
  );
};

const setup = (): { onHold: ReturnType<typeof vi.fn>; onRelease: ReturnType<typeof vi.fn> } => {
  const onHold = vi.fn();
  const onRelease = vi.fn();

  render(<Harness onHold={onHold} onRelease={onRelease} />);

  return { onHold, onRelease };
};

describe('useReplicaHold', () => {
  afterEach(() => {
    cleanup();
  });

  it('holds while focus is on the scroll area and releases after focus leaves the bubble', () => {
    const { onHold, onRelease } = setup();

    fireEvent.focus(screen.getByTestId('scroll-area'));

    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByTestId('scroll-area'), { relatedTarget: screen.getByTestId('outside') });

    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('keeps the hold when focus moves between elements inside the bubble', () => {
    const { onHold, onRelease } = setup();

    fireEvent.focus(screen.getByTestId('scroll-area'));
    fireEvent.blur(screen.getByTestId('scroll-area'), { relatedTarget: screen.getByTestId('close') });

    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('holds while the pointer is over the bubble', () => {
    const { onHold, onRelease } = setup();

    fireEvent.pointerEnter(screen.getByTestId('bubble'));

    expect(onHold).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(screen.getByTestId('bubble'));

    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('does not release when the pointer leaves while focus stays inside', () => {
    const { onHold, onRelease } = setup();

    fireEvent.pointerEnter(screen.getByTestId('bubble'));
    fireEvent.focus(screen.getByTestId('scroll-area'));
    fireEvent.pointerLeave(screen.getByTestId('bubble'));

    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
  });
});
