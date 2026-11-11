import type {
  DescMethodUnary,
  Message,
} from '@bufbuild/protobuf';
import type { ServiceImpl } from '@connectrpc/connect';
import type {
  ImportRow,
  WarehouseImportScope,
} from '@skladburg/contracts/import/v1/import';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  MethodOptions_IdempotencyLevel,
  timestampFromMs,
} from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  ImportFileInvalidParamsSchema,
  ImportFileInvalidReason,
} from '@skladburg/contracts/common/v1/error';
import {
  CommitImportResponseSchema,
  GetImportJobResponseSchema,
  GetImportTemplateResponseSchema,
  ImportJobSchema,
  ImportService,
  ImportStatus,
  ImportTemplateSchema,
  ListImportJobsResponseSchema,
  PreviewImportResponseSchema,
  RollbackImportResponseSchema,
} from '@skladburg/contracts/import/v1/import';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateReader } from '../../state/index';
import type { IRequestValidator } from '../../validation/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';
import type { WarehouseImportMetadataValue } from './warehouseImportMetadata';
import type { WarehouseXlsxCellValue } from './xlsxReader';

import { assertVersionOrInitial } from '../catalog/versionedRecords';
import { paginate } from '../pagination';
import { commitImport } from './importCommit';
import {
  boundedImportPage,
  isImportInScope,
  paginateImportRows,
  readImportRecord,
} from './importJobHandlers';
import { ImportFileError } from './importLimits';
import { rollbackImport } from './importRollback';
import {
  mapImportRows,
  readImportColumns,
} from './importRowMapping';
import { CATALOG_IMPORT_TEMPLATE } from './importTemplate';
import { validateImportRows } from './importValidation';

type ImportScopeRequestValue = Message & { warehouseScope?: undefined | WarehouseImportScope };
type ParsedImportValue = { kind: 'catalog'; table: string[][] } | { kind: 'warehouse'; table: WarehouseXlsxCellValue[][] };
type WarehouseImportAccessValue = typeof import('./warehouseImportAccess');
type WarehouseImportModuleValue = typeof import('./warehouseImport');

const loadWarehouseImport = async (scope: undefined | WarehouseImportScope): Promise<undefined | WarehouseImportModuleValue> =>
  scope === undefined ? undefined : import('./warehouseImport');

const loadWarehouseAccess = async (scope: undefined | WarehouseImportScope): Promise<undefined | WarehouseImportAccessValue> =>
  scope === undefined ? undefined : import('./warehouseImportAccess');

const readImportFile = async (fileName: string, bytes: Uint8Array, isWarehouse: boolean): Promise<ParsedImportValue> => {
  const extension = fileName.toLowerCase().split('.').at(-1);
  if (extension === 'csv' && !isWarehouse) {
    const { readCsv } = await import('./csvReader');
    return { kind: 'catalog', table: readCsv(bytes) };
  }
  if (extension === 'xlsx') {
    const { readWarehouseXlsx, readXlsx } = await import('./xlsxReader');
    return isWarehouse
      ? { kind: 'warehouse', table: await readWarehouseXlsx(bytes) }
      : { kind: 'catalog', table: await readXlsx(bytes) };
  }
  throw new ImportFileError(ImportFileInvalidReason.FORMAT);
};

export const createImportService = (runtime: IModuleRuntime, validator: IRequestValidator): ServiceImpl<typeof ImportService> => {
  const { command, errors, guard, idempotency, random, read } = runtime;
  const { method } = ImportService;
  const advanceVersion = (record: ImportRecordValue): void => {
    record.job.version += 1n;
    record.job.updatedAt = timestampFromMs(runtime.getWorldTimeMs());
  };
  const assertStatus = (record: ImportRecordValue, status: ImportStatus): void => {
    if (record.job.status !== status) {
      throw errors.invalidTransition(EntityKind.IMPORT_JOB, ImportStatus[record.job.status], ImportStatus[status]);
    }
  };

  const authorize = (
    reader: IStateReader,
    descriptor: DescMethodUnary,
    request: ImportScopeRequestValue,
    headers: Headers,
    warehouseImport: Pick<WarehouseImportAccessValue, 'requireWarehouseImportAccess'> | undefined,
  ): PermissionCallerValue => {
    const { warehouseScope } = request;
    if (warehouseScope === undefined || warehouseImport === undefined) {
      return guard.guardImportCatalogCall(reader, descriptor, request, headers);
    }

    const caller = guard.guardPermissionCall(reader, descriptor, request, headers);
    const isWrite = descriptor.idempotency !== MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS;
    warehouseImport.requireWarehouseImportAccess(reader, errors, caller, warehouseScope, isWrite);
    return caller;
  };

  const throwImportError = (error: unknown): never => {
    if (!(error instanceof ImportFileError)) {
      throw error;
    }
    throw errors.create(ErrorCode.IMPORT_FILE_INVALID, {
      case: 'importFileInvalid',
      value: create(ImportFileInvalidParamsSchema, {
        columnKey: error.columnKey,
        columnNumber: error.columnNumber,
        limit: BigInt(error.limit),
        reason: error.reason,
        rowNumber: error.rowNumber,
      }),
    });
  };

  return {
    commitImport: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseImport(warehouseScope);
      return command((transaction) => {
        const caller = authorize(transaction, method.commitImport, request, context.requestHeader, warehouseImport);
        return idempotency.run(transaction, {
          handler: () => {
            const record = readImportRecord(transaction, errors, request.jobId, caller.organizationId, warehouseScope);
            assertVersionOrInitial(errors, EntityKind.IMPORT_JOB, record.job.version, request.expectedVersion);
            assertStatus(record, ImportStatus.PREVIEW);
            if (warehouseScope === undefined || warehouseImport === undefined) {
              commitImport(transaction, runtime, validator, record);
            }
            else {
              warehouseImport.commitWarehouseImport(transaction, runtime, { caller, scope: warehouseScope, validator }, record);
            }
            advanceVersion(record);
            transaction.put('importJobs', record);
            return create(CommitImportResponseSchema, { job: record.job });
          },
          idempotencyKey: request.idempotencyKey,
          method: method.commitImport,
          request,
          scope: caller.organizationId,
        });
      });
    },
    getImportJob: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseAccess(warehouseScope);
      const caller = authorize(read, method.getImportJob, request, context.requestHeader, warehouseImport);
      const record = readImportRecord(read, errors, request.jobId, caller.organizationId, warehouseScope);
      const { items, page } = paginateImportRows(record, request.page, request.hasErrorsOnly, errors);
      return create(GetImportJobResponseSchema, { job: record.job, page, rows: items });
    },
    getImportTemplate: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseAccess(warehouseScope);
      authorize(read, method.getImportTemplate, request, context.requestHeader, warehouseImport);
      const template = warehouseScope === undefined || warehouseImport === undefined
        ? CATALOG_IMPORT_TEMPLATE
        : warehouseImport.getWarehouseImportTemplate(warehouseScope, errors);
      return create(GetImportTemplateResponseSchema, { template: clone(ImportTemplateSchema, template) });
    },
    listImportJobs: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseAccess(warehouseScope);
      const caller = authorize(read, method.listImportJobs, request, context.requestHeader, warehouseImport);
      const records = read.listBy('importJobs', 'tenantId', caller.organizationId)
        .filter(record => isImportInScope(record, warehouseScope))
        .sort((current, prev) => current.id.localeCompare(prev.id));
      const { items, page } = paginate(records, record => record.id, boundedImportPage(request.page), errors);
      return create(ListImportJobsResponseSchema, { jobs: items.map(record => record.job), page });
    },
    previewImport: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseImport(warehouseScope);
      authorize(read, method.previewImport, request, context.requestHeader, warehouseImport);

      let parsed: ParsedImportValue;
      try {
        parsed = await readImportFile(request.fileName, request.fileBytes, warehouseScope !== undefined);
      }
      catch (error) {
        return throwImportError(error);
      }

      return command((transaction) => {
        const caller = authorize(transaction, method.previewImport, request, context.requestHeader, warehouseImport);
        return idempotency.run(transaction, {
          handler: () => {
            let rows: ImportRow[];
            let columns: string[];
            let id: string;
            let metadata: undefined | WarehouseImportMetadataValue;
            try {
              if (parsed.kind === 'catalog') {
                columns = readImportColumns(parsed.table[0] ?? []);
                rows = mapImportRows(parsed.table, transaction, random, caller.organizationId);
                const rowErrors = validateImportRows(rows, transaction, caller.organizationId, validator, columns);
                rows.forEach((row, index) => row.errors.push(...(rowErrors[index] ?? [])));
                id = random.uuid();
              }
              else if (warehouseScope !== undefined && warehouseImport !== undefined) {
                id = random.uuid();
                ({ columns, metadata, rows } = warehouseImport.previewWarehouseImport(
                  transaction, runtime, { caller, jobId: id, scope: warehouseScope, validator }, parsed.table,
                ));
              }
              else {
                throw errors.internal();
              }
            }
            catch (error) {
              return throwImportError(error);
            }

            const now = timestampFromMs(runtime.getWorldTimeMs());
            const job = create(ImportJobSchema, {
              authorUserId: caller.user.id,
              createdAt: now,
              errorCount: rows.reduce((sum, row) => sum + row.errors.length, 0),
              fileName: request.fileName,
              id,
              rowCount: rows.length,
              status: ImportStatus.PREVIEW,
              templateId: warehouseScope?.templateId ?? request.templateId,
              tenantId: caller.organizationId,
              updatedAt: now,
              version: 1n,
              warehouseId: warehouseScope?.warehouseId,
            });
            transaction.put('importJobs', {
              columns, createdPriceListId: '', createdPriceListVersion: 0n, id, job, provenance: [], rows, usedListingIds: [],
              ...(metadata === undefined ? {} : { warehouseImport: metadata }),
            });
            return create(PreviewImportResponseSchema, { job });
          },
          idempotencyKey: request.idempotencyKey,
          method: method.previewImport,
          request,
          scope: caller.organizationId,
        });
      });
    },
    rollbackImport: async (request, context) => {
      const { warehouseScope } = request;
      const warehouseImport = await loadWarehouseImport(warehouseScope);
      return command((transaction) => {
        const caller = authorize(transaction, method.rollbackImport, request, context.requestHeader, warehouseImport);
        return idempotency.run(transaction, {
          handler: () => {
            const record = readImportRecord(transaction, errors, request.jobId, caller.organizationId, warehouseScope);
            assertVersionOrInitial(errors, EntityKind.IMPORT_JOB, record.job.version, request.expectedVersion);
            assertStatus(record, ImportStatus.COMMITTED);
            if (warehouseScope === undefined || warehouseImport === undefined) {
              rollbackImport(transaction, runtime, record);
            }
            else {
              warehouseImport.rollbackWarehouseImport(transaction, runtime, warehouseScope, record);
            }
            advanceVersion(record);
            transaction.put('importJobs', record);
            return create(RollbackImportResponseSchema, { job: record.job });
          },
          idempotencyKey: request.idempotencyKey,
          method: method.rollbackImport,
          request,
          scope: caller.organizationId,
        });
      });
    },
  };
};
