import {
  cleanup,
  fireEvent,
  render,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { Avatar } from './Avatar';
import { AVATAR_TONE_CLASS_NAMES } from './avatarStyles';
import { pickAvatarTone } from './pickAvatarTone';

const NAME = 'Анна Смирнова';
const SEED = '20000001-0000-4000-8000-000000000000';
const IMAGE_URL = 'https://example.invalid/avatar.png';

const renderAvatar = (props: Partial<Parameters<typeof Avatar>[0]> = {}): HTMLElement => {
  const { container } = render(<Avatar name={NAME} seed={SEED} {...props} />);
  const root = container.firstElementChild;

  if (!(root instanceof HTMLElement)) {
    throw new Error('Avatar did not render');
  }

  return root;
};

describe('Avatar', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the initials on the tone picked by the seed', () => {
    const root = renderAvatar();
    const toneClassName = AVATAR_TONE_CLASS_NAMES[pickAvatarTone(SEED, AVATAR_TONE_CLASS_NAMES.length)] ?? '';

    expect(root.textContent).toBe('АС');
    expect(root.querySelector('img')).toBeNull();
    expect(toneClassName).toBe('bg-avatar-5 text-on-avatar-5');
    expect(toneClassName.split(' ').every(className => root.classList.contains(className))).toBe(true);
  });

  it('uses another tone for another seed and the same tone for the same seed', () => {
    const first = renderAvatar();
    const firstClassName = first.className;
    cleanup();

    const again = renderAvatar();
    expect(again.className).toBe(firstClassName);
    cleanup();

    const other = renderAvatar({ seed: '20000005-0000-4000-8000-000000000000' });
    expect(other.classList.contains('bg-avatar-1')).toBe(true);
    expect(other.classList.contains('bg-avatar-5')).toBe(false);
  });

  it('is always hidden from assistive technology', () => {
    expect(renderAvatar().getAttribute('aria-hidden')).toBe('true');
    cleanup();
    expect(renderAvatar({ imageUrl: IMAGE_URL }).getAttribute('aria-hidden')).toBe('true');
    cleanup();
    expect(renderAvatar({ name: '' }).getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the image with an empty alt instead of the initials', () => {
    const root = renderAvatar({ imageUrl: IMAGE_URL });
    const image = root.querySelector('img');

    expect(image?.getAttribute('src')).toBe(IMAGE_URL);
    expect(image?.getAttribute('alt')).toBe('');
    expect(root.textContent).toBe('');
  });

  it.each([
    ['sm', '32'],
    ['md', '36'],
    ['lg', '64'],
  ] as const)('gives the %s image its size and decodes it asynchronously', (size, expectedSize) => {
    const image = renderAvatar({ imageUrl: IMAGE_URL, size }).querySelector('img');

    expect(image?.getAttribute('width')).toBe(expectedSize);
    expect(image?.getAttribute('height')).toBe(expectedSize);
    expect(image?.getAttribute('decoding')).toBe('async');
  });

  it('falls back to the initials when the image fails to load', () => {
    const root = renderAvatar({ imageUrl: IMAGE_URL });
    const image = root.querySelector('img');

    expect(image).not.toBeNull();
    if (image) {
      fireEvent.error(image);
    }

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toBe('АС');
  });

  it('tries a new image address after a failed one', () => {
    const { container, rerender } = render(<Avatar imageUrl={IMAGE_URL} name={NAME} seed={SEED} />);
    const image = container.querySelector('img');
    if (image) {
      fireEvent.error(image);
    }

    expect(container.querySelector('img')).toBeNull();

    rerender(<Avatar imageUrl={`${IMAGE_URL}?v=2`} name={NAME} seed={SEED} />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${IMAGE_URL}?v=2`);
  });

  it('treats an empty image address as missing', () => {
    const root = renderAvatar({ imageUrl: '' });

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toBe('АС');
  });

  it('shows the user icon on the tone for an empty name', () => {
    const root = renderAvatar({ name: '  ' });

    expect(root.textContent).toBe('');
    expect(root.querySelector('svg')).not.toBeNull();
    expect(root.classList.contains('bg-avatar-5')).toBe(true);
  });

  it('applies the size classes and the extra class name', () => {
    expect(renderAvatar().className).toContain('size-9');
    cleanup();
    expect(renderAvatar({ size: 'sm' }).className).toContain('size-8');
    cleanup();

    const large = renderAvatar({ className: 'extra-class', size: 'lg' });

    expect(large.className).toContain('size-16');
    expect(large.className).toContain('text-2xl');
    expect(large.className).toContain('rounded-full');
    expect(large.className).toContain('extra-class');
  });
});
