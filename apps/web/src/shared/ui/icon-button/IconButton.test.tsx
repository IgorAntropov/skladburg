import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Search } from 'lucide-react';
import { createRef } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { IconButton } from './IconButton';

const LABEL = 'Search';

describe('IconButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('is named by its label and shows no text', () => {
    render(<IconButton icon={<Search />} label={LABEL} />);
    const button = screen.getByRole('button', { name: LABEL });

    expect(button.textContent).toBe('');
  });

  it('hides the icon from assistive technology', () => {
    render(<IconButton icon={<Search />} label={LABEL} />);
    const icon = screen.getByRole('button', { name: LABEL }).querySelector('svg');

    expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('calls onClick once per click', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<Search />} label={LABEL} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: LABEL }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is busy and ignores clicks while pending', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<Search />} label={LABEL} onClick={onClick} pending />);
    const button = screen.getByRole('button', { name: LABEL });

    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('swaps the icon for the spinner while pending', () => {
    const { rerender } = render(<IconButton icon={<Search />} label={LABEL} />);
    const idleIcon = screen.getByRole('button', { name: LABEL }).querySelector('svg');

    rerender(<IconButton icon={<Search />} label={LABEL} pending />);
    const pendingIcons = screen.getByRole('button', { name: LABEL }).querySelectorAll('svg');

    expect(idleIcon?.getAttribute('class')).toContain('lucide-search');
    expect(pendingIcons).toHaveLength(1);
    expect(pendingIcons[0]?.getAttribute('class')).toContain('motion-safe:animate-spin');
  });

  it('keeps the touch target at least 44 px', () => {
    const { rerender } = render(<IconButton icon={<Search />} label={LABEL} />);

    expect(screen.getByRole('button', { name: LABEL }).className).toContain('size-11');

    rerender(<IconButton icon={<Search />} label={LABEL} size="lg" />);

    expect(screen.getByRole('button', { name: LABEL }).className).toContain('size-12');
  });

  it('passes the variant and the rest of the button props through', () => {
    render(<IconButton aria-expanded={false} icon={<Search />} label={LABEL} type="submit" variant="ghost" />);
    const button = screen.getByRole('button', { name: LABEL });

    expect(button.getAttribute('type')).toBe('submit');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.className).toContain('bg-transparent');
  });

  it('hands the ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton icon={<Search />} label={LABEL} ref={ref} />);

    expect(ref.current).toBe(screen.getByRole('button', { name: LABEL }));
  });

  it('merges the caller class name after its own classes', () => {
    render(<IconButton className="ml-auto" icon={<Search />} label={LABEL} />);

    expect(screen.getByRole('button', { name: LABEL }).className.endsWith('ml-auto')).toBe(true);
  });
});
