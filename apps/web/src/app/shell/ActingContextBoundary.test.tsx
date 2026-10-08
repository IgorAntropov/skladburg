import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import { ApiRuntimeProvider } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { ActingContextBoundary } from './ActingContextBoundary';

const OTHER_USER_ID = 'f1000009-0000-4000-8000-000000000000';
const OTHER_ORGANIZATION_ID = 'f0000009-0000-4000-8000-000000000000';

const Counter = (): ReactElement => {
  const [count, setCount] = useState(0);

  const handleClick = (): void => {
    setCount(current => current + 1);
  };

  return (
    <button data-testid="counter" onClick={handleClick} type="button">
      {count}
    </button>
  );
};

const renderBoundary = (runtime: ApiRuntimeValue): void => {
  render(
    <ApiRuntimeProvider runtime={runtime}>
      <ActingContextBoundary>
        <Counter />
      </ActingContextBoundary>
    </ApiRuntimeProvider>,
  );
};

describe('ActingContextBoundary', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the state of the subtree while the acting context stays the same', () => {
    const runtime = createTestRuntime();
    renderBoundary(runtime);

    fireEvent.click(screen.getByTestId('counter'));
    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    expect(screen.getByTestId('counter').textContent).toBe('1');
  });

  it('mounts the subtree again when the user changes inside the same organization', () => {
    const runtime = createTestRuntime();
    renderBoundary(runtime);
    fireEvent.click(screen.getByTestId('counter'));

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
    });

    expect(screen.getByTestId('counter').textContent).toBe('0');
  });

  it('mounts the subtree again when the organization changes for the same user', () => {
    const runtime = createTestRuntime();
    renderBoundary(runtime);
    fireEvent.click(screen.getByTestId('counter'));

    act(() => {
      runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    expect(screen.getByTestId('counter').textContent).toBe('0');
  });

  it('mounts the subtree again when the context is cleared', () => {
    const runtime = createTestRuntime();
    renderBoundary(runtime);
    fireEvent.click(screen.getByTestId('counter'));

    act(() => {
      runtime.actingContext.set({ organizationId: undefined, userId: undefined });
    });

    expect(screen.getByTestId('counter').textContent).toBe('0');
  });
});
