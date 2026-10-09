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

import { Skeleton } from './Skeleton';
import { SkeletonGroup } from './SkeletonGroup';

const GROUP_LABEL = 'Loading warehouses';

const renderGroup = (isFilled: boolean): HTMLElement => {
  render(
    <SkeletonGroup isFilled={isFilled} label={GROUP_LABEL}>
      <Skeleton shape="line" />
      <Skeleton shape="circle" />
      <Skeleton shape="block" />
    </SkeletonGroup>,
  );

  return screen.getByRole('status', { name: GROUP_LABEL });
};

describe('SkeletonGroup', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a busy status region with a label', () => {
    const group = renderGroup(false);

    expect(group.getAttribute('aria-busy')).toBe('true');
  });

  it('hides every shape from assistive technology', () => {
    const group = renderGroup(false);

    expect([...group.children].every(shape => shape.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('keeps the shapes in place without a fill before the threshold', () => {
    const group = renderGroup(false);

    expect(group.children).toHaveLength(3);
    expect([...group.children].some(shape => shape.className.includes('bg-skeleton'))).toBe(false);
    expect([...group.children].some(shape => shape.className.includes('animate-pulse'))).toBe(false);
  });

  it('fills the shapes and pulses them without reduced motion after the threshold', () => {
    const group = renderGroup(true);

    expect([...group.children].every(shape => shape.className.includes('bg-skeleton'))).toBe(true);
    expect([...group.children].every(shape => shape.className.includes('motion-safe:animate-skeleton-pulse'))).toBe(true);
  });
});

describe('Skeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('gives each shape its own classes', () => {
    const group = renderGroup(true);
    const [line, circle, block] = [...group.children];

    expect(new Set([block?.className, circle?.className, line?.className]).size).toBe(3);
    expect(circle?.className).toContain('rounded-full');
  });

  it('takes the size from the class name when it is given', () => {
    render(
      <SkeletonGroup isFilled label={GROUP_LABEL}>
        <Skeleton className="h-8 w-32" />
      </SkeletonGroup>,
    );
    const [shape] = [...screen.getByRole('status', { name: GROUP_LABEL }).children];

    expect(shape?.className).toContain('h-8 w-32');
    expect(shape?.className).not.toContain('h-4');
  });

  it('is filled when it stands outside a group', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.className).toContain('bg-skeleton');
  });
});
