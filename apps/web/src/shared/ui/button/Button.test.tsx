import type { SubmitEvent } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createRef } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { Button } from './Button';
import { buttonClassName } from './buttonClassName';

const SAVE_LABEL = 'Save';
const SAVING_LABEL = 'Saving';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a plain button by default', () => {
    render(<Button>{SAVE_LABEL}</Button>);

    expect(screen.getByRole('button', { name: SAVE_LABEL }).getAttribute('type')).toBe('button');
  });

  it('keeps the submit type when asked for it', () => {
    render(<Button type="submit">{SAVE_LABEL}</Button>);

    expect(screen.getByRole('button', { name: SAVE_LABEL }).getAttribute('type')).toBe('submit');
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

  it('marks the pending state for assistive technology without the native disabled attribute', () => {
    render(<Button pending>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVE_LABEL });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('shows an aria-hidden spinner and the pending label while pending', () => {
    render(<Button pending pendingLabel={SAVING_LABEL}>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVING_LABEL });

    expect(screen.queryByText(SAVE_LABEL)).toBeNull();
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('motion-safe:animate-spin');
  });

  it('keeps the children as the label while pending without a pending label', () => {
    render(<Button pending>{SAVE_LABEL}</Button>);

    expect(screen.getByRole('button', { name: SAVE_LABEL })).toBeTruthy();
  });

  it('has no spinner and no pending attributes when idle', () => {
    render(<Button>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVE_LABEL });

    expect(button.querySelector('svg')).toBeNull();
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
  });

  it('keeps the focus on the button when it becomes pending', () => {
    const { rerender } = render(<Button>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVE_LABEL });
    button.focus();

    expect(document.activeElement).toBe(button);

    rerender(<Button pending pendingLabel={SAVING_LABEL}>{SAVE_LABEL}</Button>);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: SAVING_LABEL }));
    expect(document.activeElement).toBe(button);
  });

  it('cannot take the focus when natively disabled', () => {
    render(<Button disabled>{SAVE_LABEL}</Button>);
    const button = screen.getByRole('button', { name: SAVE_LABEL });
    button.focus();

    expect(document.activeElement).not.toBe(button);
  });

  it('does not call onClick when natively disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>{SAVE_LABEL}</Button>);

    fireEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

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

  it('hands the ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>{SAVE_LABEL}</Button>);

    expect(ref.current).toBe(screen.getByRole('button', { name: SAVE_LABEL }));
  });

  it('merges the caller class name after its own classes', () => {
    render(<Button className="w-full">{SAVE_LABEL}</Button>);

    expect(screen.getByRole('button', { name: SAVE_LABEL }).className.endsWith('w-full')).toBe(true);
  });
});

describe('buttonClassName', () => {
  it('gives every variant its own classes', () => {
    const primary = buttonClassName({ variant: 'primary' });
    const secondary = buttonClassName({ variant: 'secondary' });
    const ghost = buttonClassName({ variant: 'ghost' });

    expect(new Set([ghost, primary, secondary]).size).toBe(3);
  });

  it('gives every size its own classes and keeps the touch target large enough', () => {
    const medium = buttonClassName({ size: 'md' });
    const large = buttonClassName({ size: 'lg' });

    expect(medium).not.toBe(large);
    expect(medium).toContain('min-h-11');
    expect(large).toContain('min-h-12');
  });

  it('defaults to the primary variant and the medium size', () => {
    expect(buttonClassName({})).toBe(buttonClassName({ size: 'md', variant: 'primary' }));
  });

  it('focuses with the focus token ring and avoids the double-tap zoom', () => {
    const className = buttonClassName({});

    expect(className).toContain('focus-visible:outline-focus');
    expect(className).toContain('touch-manipulation');
    expect(className).not.toContain('outline-primary');
  });

  it('keeps the secondary text off the primary color', () => {
    expect(buttonClassName({ variant: 'secondary' })).not.toContain('text-primary');
  });
});
