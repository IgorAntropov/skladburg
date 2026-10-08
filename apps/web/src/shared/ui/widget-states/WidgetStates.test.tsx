import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { Skeleton } from '../skeleton/Skeleton';
import { withLocalizer } from '../testing/withLocalizer';
import { WidgetStates } from './WidgetStates';

interface WidgetStatesCaseValue {
  data: string[] | undefined;
  error: Error | null;
  isRetrying?: boolean | undefined;
  onRetry?: (() => void) | undefined;
}

const LOADING_LABEL = 'Loading warehouses';
const EMPTY_TEXT = 'Nothing here yet';
const FIRST_ITEM = 'North';
const SECOND_ITEM = 'South';

const advance = (milliseconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

const createFailure = (): Error => new Error('failure');

const createWidget = ({ data, error, isRetrying, onRetry }: WidgetStatesCaseValue): ReactElement => withLocalizer(
  <WidgetStates
    data={data}
    empty={<p>{EMPTY_TEXT}</p>}
    error={error}
    isEmpty={items => items.length === 0}
    isRetrying={isRetrying}
    loadingLabel={LOADING_LABEL}
    onRetry={onRetry}
    skeleton={<Skeleton />}
  >
    {items => <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>}
  </WidgetStates>,
);

const isSkeletonFilled = (): boolean => {
  const shape = screen.getByRole('status', { name: LOADING_LABEL }).firstElementChild;

  return shape?.className.includes('bg-skeleton') === true;
};

describe('WidgetStates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the content when there is data', () => {
    render(createWidget({ data: [FIRST_ITEM, SECOND_ITEM], error: null }));

    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([FIRST_ITEM, SECOND_ITEM]);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the empty state instead of the content when the data is empty', () => {
    render(createWidget({ data: [], error: null }));

    expect(screen.getByText(EMPTY_TEXT)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the content when there is no empty check at all', () => {
    render(withLocalizer(
      <WidgetStates
        data={[]}
        error={null}
        loadingLabel={LOADING_LABEL}
        onRetry={undefined}
        skeleton={<Skeleton />}
      >
        {items => <p>{items.length}</p>}
      </WidgetStates>,
    ));

    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the skeleton group with its label at once, but without a fill', () => {
    render(createWidget({ data: undefined, error: null }));

    expect(screen.getByRole('status', { name: LOADING_LABEL }).getAttribute('aria-busy')).toBe('true');
    expect(isSkeletonFilled()).toBe(false);
  });

  it('fills the skeleton only after the delay', () => {
    render(createWidget({ data: undefined, error: null }));

    advance(249);

    expect(isSkeletonFilled()).toBe(false);

    advance(1);

    expect(isSkeletonFilled()).toBe(true);
  });

  it('never fills the skeleton when the data arrives within the delay', () => {
    const { rerender } = render(createWidget({ data: undefined, error: null }));

    advance(200);

    expect(isSkeletonFilled()).toBe(false);

    rerender(createWidget({ data: [FIRST_ITEM], error: null }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
  });

  it('keeps the filled skeleton until the minimum visible time has passed, then shows the data', () => {
    const { rerender } = render(createWidget({ data: undefined, error: null }));

    advance(250);
    advance(50);
    rerender(createWidget({ data: [FIRST_ITEM], error: null }));

    expect(isSkeletonFilled()).toBe(true);
    expect(screen.queryByText(FIRST_ITEM)).toBeNull();

    advance(349);

    expect(screen.queryByText(FIRST_ITEM)).toBeNull();

    advance(1);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
  });

  it('shows the data at once after a long load, with the skeleton filled until then', () => {
    const { rerender } = render(createWidget({ data: undefined, error: null }));

    advance(250);
    advance(1750);

    expect(isSkeletonFilled()).toBe(true);

    rerender(createWidget({ data: [FIRST_ITEM], error: null }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
  });

  it('never shows a skeleton when the data is on the screen already', () => {
    const { rerender } = render(createWidget({ data: [FIRST_ITEM], error: null }));

    advance(1000);
    rerender(createWidget({ data: [FIRST_ITEM], error: null, isRetrying: true }));
    advance(1000);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
  });

  it('keeps the old data and shows no error when a reload fails', () => {
    const { rerender } = render(createWidget({ data: [FIRST_ITEM], error: null }));

    rerender(createWidget({ data: [FIRST_ITEM], error: createFailure() }));

    expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the error with the text of its code and no data', () => {
    render(createWidget({ data: undefined, error: createFailure() }));

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.internal']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the error at once when it comes while the skeleton is filled', () => {
    const { rerender } = render(createWidget({ data: undefined, error: null }));

    advance(300);
    rerender(createWidget({ data: undefined, error: createFailure() }));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('retries on the button of the error and shows the retrying state', () => {
    const onRetry = vi.fn();
    const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(createWidget({ data: undefined, error: createFailure(), isRetrying: true, onRetry }));
    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry button when there is no retry handler', () => {
    render(createWidget({ data: undefined, error: createFailure() }));

    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('over a retry that clears the error', () => {
    it('keeps the error, the button and the focus while the request is retried', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));
      const button = screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] });

      button.focus();
      rerender(createWidget({ data: undefined, error: null, isRetrying: true, onRetry }));

      const retryingButton = screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

      expect(retryingButton).toBe(button);
      expect(document.activeElement).toBe(button);
      expect(retryingButton.getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.internal']);
      expect(screen.queryByRole('status')).toBeNull();

      advance(1000);

      expect(document.activeElement).toBe(button);
      expect(screen.queryByRole('status')).toBeNull();

      rerender(createWidget({ data: undefined, error: createFailure(), isRetrying: false, onRetry }));

      expect(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] })).toBe(button);
      expect(document.activeElement).toBe(button);
      expect(button.getAttribute('aria-disabled')).toBeNull();
    });

    it('ignores the retry clicks while the held error is shown', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));

      rerender(createWidget({ data: undefined, error: null, isRetrying: true, onRetry }));
      fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] }));

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('announces a repeated error with the same text again', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));
      const firstAlert = screen.getByRole('alert');

      rerender(createWidget({ data: undefined, error: null, isRetrying: true, onRetry }));

      expect(screen.getByRole('alert')).toBe(firstAlert);

      rerender(createWidget({ data: undefined, error: createFailure(), isRetrying: false, onRetry }));

      const secondAlert = screen.getByRole('alert');

      expect(secondAlert).not.toBe(firstAlert);
      expect(secondAlert.textContent).toBe(firstAlert.textContent);
    });

    it('does not announce the same error again while it is only held or shown on', () => {
      const failure = createFailure();
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: failure, onRetry }));
      const alert = screen.getByRole('alert');

      rerender(createWidget({ data: undefined, error: failure, isRetrying: true, onRetry }));
      rerender(createWidget({ data: undefined, error: failure, isRetrying: false, onRetry }));

      expect(screen.getByRole('alert')).toBe(alert);
    });

    it('shows the data when the retry succeeds', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));

      rerender(createWidget({ data: undefined, error: null, isRetrying: true, onRetry }));
      rerender(createWidget({ data: [FIRST_ITEM], error: null, isRetrying: false, onRetry }));

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText(FIRST_ITEM)).toBeTruthy();
    });

    it('shows the skeleton, not the old error, when the request goes on without a retry mark', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));

      rerender(createWidget({ data: undefined, error: null, isRetrying: false, onRetry }));

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status', { name: LOADING_LABEL })).toBeTruthy();
    });

    it('does not bring an old error back after the data has been shown', () => {
      const onRetry = vi.fn();
      const { rerender } = render(createWidget({ data: undefined, error: createFailure(), onRetry }));

      rerender(createWidget({ data: [FIRST_ITEM], error: null, onRetry }));
      rerender(createWidget({ data: undefined, error: null, isRetrying: true, onRetry }));

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status', { name: LOADING_LABEL })).toBeTruthy();
    });
  });
});
