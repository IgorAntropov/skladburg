import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
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

import type { RequisitesViewValue } from './useRequisitesView';

import { useRequisitesView } from './useRequisitesView';

const OTHER_ORGANIZATION_ID = 'f0000009-0000-4000-8000-000000000000';

const renderViewHook = (runtime: ApiRuntimeValue): RenderHookResult<RequisitesViewValue, unknown> => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>{children}</ApiRuntimeProvider>
  );

  return renderHook(useRequisitesView, { wrapper: Wrapper });
};

describe('useRequisitesView', () => {
  beforeEach(() => {
    const { result, unmount } = renderViewHook(createTestRuntime());

    act(() => {
      result.current.close();
    });
    unmount();
  });

  afterEach(() => {
    cleanup();
  });

  it('is closed until it is opened and closed again after close', () => {
    const { result } = renderViewHook(createTestRuntime());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('is open in every place that reads it', () => {
    const runtime = createTestRuntime();
    const first = renderViewHook(runtime);
    const second = renderViewHook(runtime);

    act(() => {
      first.result.current.open();
    });

    expect(second.result.current.isOpen).toBe(true);
  });

  it('is closed for another organization after the acting organization changes', () => {
    const runtime = createTestRuntime();
    const { result } = renderViewHook(runtime);

    act(() => {
      result.current.open();
    });
    act(() => {
      runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    expect(result.current.isOpen).toBe(true);
  });
});
