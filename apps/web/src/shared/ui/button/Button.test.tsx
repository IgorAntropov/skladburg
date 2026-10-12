import type { SubmitEvent } from 'react';

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

import { Button } from './Button';

const SAVE_LABEL = 'Save';
const SAVING_LABEL = 'Saving';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls onClick once per click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{SAVE_LABEL}</Button>);

    fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never reaches onClick while pending, however many times it is clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} pending>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVE_LABEL });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.doubleClick(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('ignores the clicks while pending with a pending label', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} pending pendingLabel={SAVING_LABEL}>{SAVE_LABEL}</Button>);

    fireEvent.click(screen.getByRole('button', { name: SAVING_LABEL }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit the form of a pending submit button', () => {
    const onSubmit = vi.fn((event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button pending type="submit">{SAVE_LABEL}</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the form of an idle submit button once', () => {
    const onSubmit = vi.fn((event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">{SAVE_LABEL}</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
