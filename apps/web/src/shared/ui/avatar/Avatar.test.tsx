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
});
