import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  ImportService,
  ImportStatus,
  WarehouseImportScopeSchema,
} from '@skladburg/contracts/import/v1/import';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import type { ImportTargetValue } from '../model/importTarget';

import {
  useImportHistory,
  useImportRows,
  useImportTemplate,
} from './useImportQueries';

const FIRST_WAREHOUSE_ID = 'f0000003-0000-4000-8000-000000000000';
const SECOND_WAREHOUSE_ID = 'f0000004-0000-4000-8000-000000000000';
const SECOND_USER_ID = 'f0000005-0000-4000-8000-000000000000';
const JOB_ID = 'f0000006-0000-4000-8000-000000000000';

describe('import queries', () => {
  afterEach(cleanup);

  it('uses scoped RPCs and cache entries for each template, warehouse, and acting user', async () => {
    const calls: unknown[] = [];
    const runtime = createTestRuntime({
      routes: router => router.service(ImportService, {
        getImportJob: (request) => {
          const { jobId, warehouseScope } = request;
          calls.push({ jobId, warehouseScope });

          return { job: { id: jobId, status: ImportStatus.PREVIEW, templateId: warehouseScope?.templateId ?? 'catalog' } };
        },
        getImportTemplate: (request) => {
          const { templateId, warehouseScope } = request;
          calls.push({ templateId, warehouseScope });

          return { template: { id: warehouseScope?.templateId ?? templateId } };
        },
        listImportJobs: ({ warehouseScope }) => {
          calls.push({ warehouseScope });

          return {};
        },
      }),
    });
    const client = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { rerender, result } = renderHook(({ target }: { target: ImportTargetValue }) => ({
      history: useImportHistory(target),
      rows: useImportRows(target, JOB_ID, false),
      template: useImportTemplate(target),
    }), {
      initialProps: { target: { kind: 'catalog' } },
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.history.isSuccess && result.current.rows.isSuccess && result.current.template.isSuccess).toBe(true);
    });
    expect(calls).toEqual(expect.arrayContaining([
      { jobId: JOB_ID, warehouseScope: undefined },
      { templateId: 'catalog', warehouseScope: undefined },
      { warehouseScope: undefined },
    ]));

    const warehouseScopes = [
      { templateId: 'warehouse_cells', warehouseId: FIRST_WAREHOUSE_ID },
      { templateId: 'opening_stock', warehouseId: FIRST_WAREHOUSE_ID },
      { templateId: 'opening_stock', warehouseId: SECOND_WAREHOUSE_ID },
    ] as const;

    for (const scope of warehouseScopes) {
      rerender({ target: { ...scope, kind: 'warehouse' } });
      await waitFor(() => {
        expect(result.current.history.isSuccess && result.current.rows.isSuccess && result.current.template.isSuccess).toBe(true);
      });
      const warehouseScope = create(WarehouseImportScopeSchema, scope);
      expect(calls).toContainEqual({ jobId: JOB_ID, warehouseScope });
      expect(calls).toContainEqual({ templateId: '', warehouseScope });
      expect(calls).toContainEqual({ warehouseScope });
      const cacheKey = ['data-import', TEST_ORGANIZATION_ID, TEST_USER_ID, scope.warehouseId, scope.templateId];
      expect(client.getQueryData([...cacheKey, 'jobs'])).toBeDefined();
      expect(client.getQueryData([...cacheKey, 'rows', JOB_ID, false])).toBeDefined();
      expect(client.getQueryData([...cacheKey, 'template'])).toMatchObject({ id: scope.templateId });
    }

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: SECOND_USER_ID });
    });
    await waitFor(() => {
      const cacheKey = ['data-import', TEST_ORGANIZATION_ID, SECOND_USER_ID, SECOND_WAREHOUSE_ID, 'opening_stock'];
      expect(client.getQueryData([...cacheKey, 'template'])).toMatchObject({ id: 'opening_stock' });
    });
  });
});
