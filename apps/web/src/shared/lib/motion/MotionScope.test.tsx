import type { FeatureBundle } from 'motion/react';
import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  MotionScope,
  useAreMotionFeaturesLoaded,
} from './index';
import { loadMotionFeatures } from './loadMotionFeatures';

vi.mock('./loadMotionFeatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loadMotionFeatures')>();

  return { loadMotionFeatures: vi.fn(actual.loadMotionFeatures) };
});

const CONTENT_TEXT = 'content';
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

  it('requests the features once the scope is rendered', async () => {
    render(
      <MotionScope>
        <FeaturesStatus />
      </MotionScope>,
    );

    expect(vi.mocked(loadMotionFeatures)).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(LOADED_TEXT)).toBeDefined();
  });

  it('reports that the features are not loaded while they are on their way and renders the children at once', async () => {
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

  it('reports the features as not loaded outside of a scope', () => {
    render(<FeaturesStatus />);

    expect(screen.getByText(PENDING_TEXT)).toBeDefined();
  });
});
