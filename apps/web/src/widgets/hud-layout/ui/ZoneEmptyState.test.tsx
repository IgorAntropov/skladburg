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
});
