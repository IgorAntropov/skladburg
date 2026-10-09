import {
  cleanup,
  render,
} from '@testing-library/react';
import { Truck } from 'lucide-react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { ZoneEmptyState } from './ZoneEmptyState';

describe('ZoneEmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the text as a paragraph', () => {
    const { getByText } = render(<ZoneEmptyState icon={Truck} text="No trips yet" />);

    expect(getByText('No trips yet').tagName).toBe('P');
  });

  it('hides the icon from assistive technology', () => {
    const { container } = render(<ZoneEmptyState icon={Truck} text="No trips yet" />);

    const iconWrapper = container.querySelector('span');

    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(iconWrapper?.querySelector('svg')).not.toBeNull();
  });

  it('stacks the icon above a centered phrase on every width', () => {
    const { container } = render(<ZoneEmptyState icon={Truck} text="No trips yet" />);
    const root = container.firstElementChild;

    expect(root?.className).toContain('flex-col');
    expect(root?.className).toContain('text-center');
    expect(root?.className).not.toMatch(/@md:|flex-row/);
  });

  it('puts the icon on a quiet hover circle', () => {
    const { container } = render(<ZoneEmptyState icon={Truck} text="No trips yet" />);
    const circle = container.querySelector('span');

    expect(circle?.className).toContain('bg-hover');
    expect(circle?.className).not.toContain('bg-skeleton');
  });
});
