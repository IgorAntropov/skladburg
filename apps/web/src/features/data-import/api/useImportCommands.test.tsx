import type {
  ImportJob,
  WarehouseImportScope,
} from '@skladburg/contracts/import/v1/import';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  ImportJobSchema,
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
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import type { ImportOptionsValue } from '../model/importOptions';

import { useImportJobCommand } from './useImportJobCommand';
import { usePreviewImport } from './usePreviewImport';

const WAREHOUSE_ID = 'f0000003-0000-4000-8000-000000000000';
const JOB_ID = 'f0000006-0000-4000-8000-000000000000';
const OPTIONS = {
  target: { kind: 'warehouse', templateId: 'warehouse_cells', warehouseId: WAREHOUSE_ID },
  writeAccess: { status: 'allowed' },
} as const satisfies Pick<ImportOptionsValue, 'target' | 'writeAccess'>;

const makeJob = (status: ImportStatus): ImportJob =>
  create(ImportJobSchema, { id: JOB_ID, status, templateId: OPTIONS.target.templateId, version: 1n, warehouseId: WAREHOUSE_ID });

describe('warehouse import commands', () => {
  afterEach(cleanup);

  it('sends the chosen warehouse and template for preview, commit, and rollback', async () => {
    const captured: (undefined | WarehouseImportScope)[] = [];
    const runtime = createTestRuntime({
      routes: router => router.service(ImportService, {
        commitImport: ({ warehouseScope }) => {
          captured.push(warehouseScope);

          return { job: makeJob(ImportStatus.COMMITTED) };
        },
        previewImport: ({ templateId, warehouseScope }) => {
          expect(templateId).toBe('');
          captured.push(warehouseScope);

          return { job: makeJob(ImportStatus.PREVIEW) };
        },
        rollbackImport: ({ warehouseScope }) => {
          captured.push(warehouseScope);

          return { job: makeJob(ImportStatus.ROLLED_BACK) };
        },
      }),
    });
    const client = createQueryClient({ networkMode: 'always' });
    const onPreview = vi.fn<(job: ImportJob) => void>();
    const onUpdate = vi.fn<(job: ImportJob) => void>();

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(() => ({
      commit: useImportJobCommand(OPTIONS, makeJob(ImportStatus.PREVIEW), onUpdate),
      preview: usePreviewImport(OPTIONS, onPreview),
      rollback: useImportJobCommand(OPTIONS, makeJob(ImportStatus.COMMITTED), onUpdate),
    }), { wrapper: Wrapper });

    const file = Object.assign(new File(['a'], 'cells.xlsx'), { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) });
    act(() => {
      result.current.preview.selectFile(file);
    });
    await waitFor(() => {
      expect(result.current.preview.fileName).toBe('cells.xlsx');
    });

    act(() => {
      result.current.preview.command.run();
    });
    await waitFor(() => {
      expect(onPreview).toHaveBeenCalledWith(makeJob(ImportStatus.PREVIEW));
    });
    act(() => {
      result.current.commit.command.run();
    });
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(makeJob(ImportStatus.COMMITTED));
    });
    act(() => {
      result.current.rollback.command.run();
    });
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(makeJob(ImportStatus.ROLLED_BACK));
    });

    const expected = create(WarehouseImportScopeSchema, {
      templateId: OPTIONS.target.templateId,
      warehouseId: WAREHOUSE_ID,
    });
    expect(captured).toEqual([expected, expected, expected]);
  });
});
