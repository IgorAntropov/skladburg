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

import { TextInput } from './TextInput';

const LABEL = 'Query';

describe('TextInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a plain text field by default', () => {
    render(<TextInput aria-label={LABEL} />);

    expect(screen.getByRole('textbox', { name: LABEL }).getAttribute('type')).toBe('text');
  });

  it('can be a search field', () => {
    render(<TextInput aria-label={LABEL} type="search" />);

    expect(screen.getByRole('searchbox', { name: LABEL })).toBeDefined();
  });

  it('passes the value, the change handler and the ref to the input', () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<TextInput aria-label={LABEL} onChange={onChange} ref={ref} value="abc" />);

    fireEvent.change(screen.getByRole('textbox', { name: LABEL }), { target: { value: 'abcd' } });

    expect(ref.current).toBe(screen.getByRole('textbox', { name: LABEL }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('merges the given class name with its own', () => {
    render(<TextInput aria-label={LABEL} className="w-80" />);
    const input = screen.getByRole('textbox', { name: LABEL });

    expect(input.className).toContain('w-80');
    expect(input.className).toContain('min-h-11');
  });
});
