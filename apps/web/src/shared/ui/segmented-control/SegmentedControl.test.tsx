import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Sun } from 'lucide-react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { SegmentedControlOptionValue } from './SegmentedControl';

import { SegmentedControl } from './SegmentedControl';

type ThemeValue = 'dark' | 'light' | 'system';

const GROUP_LABEL = 'Theme';
const FIRST_LABEL = 'First';
const SECOND_LABEL = 'Second';

const OPTIONS: readonly SegmentedControlOptionValue<ThemeValue>[] = [
  { icon: <Sun />, label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

describe('SegmentedControl', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a group named by its label with a radio for every option', () => {
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />);

    expect(screen.getByRole('group', { name: GROUP_LABEL })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(OPTIONS.length);
  });

  it('checks the current value only', () => {
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="dark" />);

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Dark' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Light' }).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'System' }).checked).toBe(false);
  });

  it('shares one name between the radios of a control and not between controls', () => {
    render(
      <>
        <SegmentedControl label={FIRST_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />
        <SegmentedControl label={SECOND_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />
      </>,
    );
    const names = screen.getAllByRole<HTMLInputElement>('radio').map(radio => radio.name);

    expect(new Set(names.slice(0, 3)).size).toBe(1);
    expect(new Set(names.slice(3)).size).toBe(1);
    expect(names[0]).not.toBe(names[3]);
  });

  it('reports the clicked value', () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={onValueChange} options={OPTIONS} value="light" />);

    fireEvent.click(screen.getByRole('radio', { name: 'System' }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('system');
  });

  it('does not report the value that is already checked', () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={onValueChange} options={OPTIONS} value="light" />);

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows the visible label of every option and hides the icon from assistive technology', () => {
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />);
    const lightLabel = screen.getByText('Light').closest('label');

    expect(screen.getByText('Dark').textContent).toBe('Dark');
    expect(lightLabel?.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the group label unless it is hidden', () => {
    const { rerender } = render(
      <SegmentedControl label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />,
    );

    expect(screen.getByText(GROUP_LABEL).className).not.toContain('sr-only');

    rerender(<SegmentedControl isLabelHidden label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />);

    expect(screen.getByText(GROUP_LABEL).className).toContain('sr-only');
    expect(screen.getByRole('group', { name: GROUP_LABEL })).toBeTruthy();
  });

  it('keeps the touch target of every option at least 44 px and shows the focus on the visible label', () => {
    render(<SegmentedControl label={GROUP_LABEL} onValueChange={vi.fn()} options={OPTIONS} value="light" />);
    const optionLabel = screen.getByText('Dark').closest('label');

    expect(optionLabel?.className).toContain('min-h-11');
    expect(optionLabel?.className).toContain('min-w-11');
    expect(optionLabel?.className).toContain('has-focus-visible:outline-focus');
  });
});
