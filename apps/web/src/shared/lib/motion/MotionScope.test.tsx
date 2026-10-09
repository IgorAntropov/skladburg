import type { FeatureBundle } from 'motion/react';
import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { motion } from 'motion/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AnimatePresence,
  m,
  MotionScope,
  useAreMotionFeaturesLoaded,
} from './index';
import { loadMotionFeatures } from './loadMotionFeatures';

vi.mock('./loadMotionFeatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loadMotionFeatures')>();

  return { loadMotionFeatures: vi.fn(actual.loadMotionFeatures) };
});

const CONTENT_TEXT = 'content';
const ANIMATED_TEXT = 'animated';
const FULL_TEXT = 'full';
const LOADED_TEXT = 'features loaded';
const PENDING_TEXT = 'features pending';

interface DeferredBundleValue {
  promise: Promise<FeatureBundle>;
  resolve: (bundle: FeatureBundle) => void;
}

const createDeferredBundle = (): DeferredBundleValue => {
  let resolve: (bundle: FeatureBundle) => void = () => undefined;
  const promise = new Promise<FeatureBundle>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const FeaturesStatus = (): ReactElement => {
  const areFeaturesLoaded = useAreMotionFeaturesLoaded();

  return <p>{areFeaturesLoaded ? LOADED_TEXT : PENDING_TEXT}</p>;
};

describe('MotionScope', () => {
  afterEach(() => {
    cleanup();
    vi.mocked(loadMotionFeatures).mockClear();
  });

  it('renders the children', () => {
    render(
      <MotionScope>
        <p>{CONTENT_TEXT}</p>
      </MotionScope>,
    );

    expect(screen.getByText(CONTENT_TEXT)).toBeDefined();
  });

  it('lets the lazy motion components animate inside the strict scope', () => {
    render(
      <MotionScope>
        <AnimatePresence>
          <m.div animate={{ opacity: 1 }} initial={false}>{ANIMATED_TEXT}</m.div>
        </AnimatePresence>
      </MotionScope>,
    );

    expect(screen.getByText(ANIMATED_TEXT).tagName).toBe('DIV');
  });

  it('refuses the full motion component inside the strict scope', () => {
    const originalError = console.error;
    console.error = () => undefined;

    try {
      expect(() => render(
        <MotionScope>
          <motion.p animate={{ opacity: 1 }}>{FULL_TEXT}</motion.p>
        </MotionScope>,
      )).toThrow();
    }
    finally {
      console.error = originalError;
    }
  });

  it('requests the features once the scope is rendered', async () => {
    render(
      <MotionScope>
        <FeaturesStatus />
      </MotionScope>,
    );

    expect(vi.mocked(loadMotionFeatures)).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(LOADED_TEXT)).toBeDefined();
  });

  describe('while the features are on their way', () => {
    it('reports that the features are not loaded and renders the children at once', async () => {
      const deferred = createDeferredBundle();
      vi.mocked(loadMotionFeatures).mockImplementationOnce(() => deferred.promise);

      render(
        <MotionScope>
          <FeaturesStatus />
          <p>{CONTENT_TEXT}</p>
        </MotionScope>,
      );

      expect(screen.getByText(PENDING_TEXT)).toBeDefined();
      expect(screen.getByText(CONTENT_TEXT)).toBeDefined();

      const actual = await vi.importActual<typeof import('./loadMotionFeatures')>('./loadMotionFeatures');
      await act(async () => {
        deferred.resolve(await actual.loadMotionFeatures());
      });

      expect(await screen.findByText(LOADED_TEXT)).toBeDefined();
    });

    it('keeps the initial style of a lazy component until the features arrive and then runs its animation', async () => {
      const deferred = createDeferredBundle();
      vi.mocked(loadMotionFeatures).mockImplementationOnce(() => deferred.promise);

      render(
        <MotionScope>
          <m.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>{ANIMATED_TEXT}</m.div>
        </MotionScope>,
      );

      const element = screen.getByText(ANIMATED_TEXT);

      expect(element.style.opacity).toBe('0');

      const actual = await vi.importActual<typeof import('./loadMotionFeatures')>('./loadMotionFeatures');
      await act(async () => {
        deferred.resolve(await actual.loadMotionFeatures());
      });

      await waitFor(() => {
        expect(element.style.opacity).toBe('1');
      });
    });

    it('removes a component that leaves the presence at once, without waiting for an exit animation', async () => {
      const deferred = createDeferredBundle();
      vi.mocked(loadMotionFeatures).mockImplementationOnce(() => deferred.promise);

      const toTree = (isShown: boolean): ReactElement => (
        <MotionScope>
          <AnimatePresence>
            {isShown && <m.div animate={{ opacity: 1 }} exit={{ opacity: 0 }} initial={false} key="item">{ANIMATED_TEXT}</m.div>}
          </AnimatePresence>
        </MotionScope>
      );
      const rendered = render(toTree(true));

      expect(screen.getByText(ANIMATED_TEXT)).toBeDefined();

      rendered.rerender(toTree(false));

      await waitFor(() => {
        expect(screen.queryByText(ANIMATED_TEXT)).toBeNull();
      });
    });
  });

  it('reports the features as not loaded outside of a scope', () => {
    render(<FeaturesStatus />);

    expect(screen.getByText(PENDING_TEXT)).toBeDefined();
  });
});
