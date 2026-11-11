import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  VersionConflictParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  ImportJobSchema,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';
import {
  cleanup,
  fireEvent,
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

import { withTestLocalizer } from '@/shared/i18n/index.testing';

import type { ImportOptionsValue } from '../model/importOptions';

import { useImportJobCommand } from '../api/useImportJobCommand';
import { ImportJobAction } from './ImportJobAction';

vi.mock('../api/useImportJobCommand', () => ({ useImportJobCommand: vi.fn() }));

const OPTIONS: ImportOptionsValue = {
  formatRow: () => undefined,
  getRuleMessage: () => undefined,
  t: (key: string, ..._params: unknown[]): string => key,
  target: { kind: 'warehouse', templateId: 'warehouse_cells', warehouseId: 'warehouse' },
  writeAccess: { status: 'allowed' },
};

describe('import conflict recovery', () => {
  afterEach(cleanup);

  it.each([
    { entity: EntityKind.WAREHOUSE, recovery: 'dataImport.backToFile' },
    { entity: EntityKind.IMPORT_JOB, recovery: 'dataImport.refresh' },
  ])('uses the recovery action for entity $entity', ({ entity, recovery }) => {
    const onChooseFile = vi.fn<() => void>();
    const reload = vi.fn<() => void>();
    vi.mocked(useImportJobCommand).mockReturnValue({
      access: { status: 'allowed' },
      command: {
        apiError: {
          code: ErrorCode.VERSION_CONFLICT,
          isRetryable: false,
          params: { case: 'versionConflict', value: create(VersionConflictParamsSchema, { entity }) },
          traceId: undefined,
        },
        error: new Error('Conflict'),
        failedAt: 1,
        isPending: false,
        method: undefined,
        reset: vi.fn(),
        run: vi.fn(),
      },
      reload,
    });

    render(withTestLocalizer(
      <ImportJobAction
        job={create(ImportJobSchema, { status: ImportStatus.PREVIEW })}
        onChooseFile={onChooseFile}
        onSuccess={vi.fn()}
        options={OPTIONS}
        template={undefined}
      />,
    ));

    fireEvent.click(screen.getByRole('button', { name: recovery }));
    expect(onChooseFile).toHaveBeenCalledTimes(entity === EntityKind.WAREHOUSE ? 1 : 0);
    expect(reload).toHaveBeenCalledTimes(entity === EntityKind.IMPORT_JOB ? 1 : 0);
  });
});
