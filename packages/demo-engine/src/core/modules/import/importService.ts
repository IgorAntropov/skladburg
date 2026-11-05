import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
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

import type { IRequestValidator } from '../../validation/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';

import { assertVersionOrInitial } from '../catalog/versionedRecords';
import { paginate } from '../pagination';
import { commitImport } from './importCommit';
import {
  boundedImportPage,
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

export const createImportService = (runtime: IModuleRuntime, validator: IRequestValidator): ServiceImpl<typeof ImportService> => {
  const { command, errors, guard, idempotency, random, read } = runtime;
  const advanceVersion = (record: ImportRecordValue): void => {
    record.job.version += 1n;
    record.job.updatedAt = timestampFromMs(runtime.getWorldTimeMs());
  };
  const assertStatus = (record: ImportRecordValue, status: ImportStatus): void => {
    if (record.job.status !== status) {
      throw errors.invalidTransition(EntityKind.IMPORT_JOB, ImportStatus[record.job.status], ImportStatus[status]);
    }
  };

  return {
    commitImport: (request, context) => command((transaction) => {
      const caller = guard.guardImportCatalogCall(transaction, ImportService.method.commitImport, request, context.requestHeader);
      return idempotency.run(transaction, {
        handler: () => {
          const record = readImportRecord(transaction, errors, request.jobId, caller.organizationId);
          assertVersionOrInitial(errors, EntityKind.IMPORT_JOB, record.job.version, request.expectedVersion);
          assertStatus(record, ImportStatus.PREVIEW);
          commitImport(transaction, runtime, validator, record);
          advanceVersion(record);
          transaction.put('importJobs', record);
          return create(CommitImportResponseSchema, { job: record.job });
        },
        idempotencyKey: request.idempotencyKey,
        method: ImportService.method.commitImport,
        request,
        scope: caller.organizationId,
      });
    }),
    getImportJob: (request, context) => {
      const caller = guard.guardImportCatalogCall(read, ImportService.method.getImportJob, request, context.requestHeader);
      const record = readImportRecord(read, errors, request.jobId, caller.organizationId);
      const { items, page } = paginateImportRows(record, request.page, request.hasErrorsOnly, errors);
      return create(GetImportJobResponseSchema, { job: record.job, page, rows: items });
    },
    getImportTemplate: (request, context) => {
      guard.guardImportCatalogCall(read, ImportService.method.getImportTemplate, request, context.requestHeader);
      return create(GetImportTemplateResponseSchema, { template: clone(ImportTemplateSchema, CATALOG_IMPORT_TEMPLATE) });
    },
    listImportJobs: (request, context) => {
      const caller = guard.guardImportCatalogCall(read, ImportService.method.listImportJobs, request, context.requestHeader);
      const records = read.listBy('importJobs', 'tenantId', caller.organizationId)
        .sort((current, prev) => current.id.localeCompare(prev.id));
      const { items, page } = paginate(records, record => record.id, boundedImportPage(request.page), errors);
      return create(ListImportJobsResponseSchema, { jobs: items.map(record => record.job), page });
    },
    previewImport: async (request, context) => {
      guard.guardImportCatalogCall(read, ImportService.method.previewImport, request, context.requestHeader);
      let table: string[][];
      try {
        const extension = request.fileName.toLowerCase().split('.').at(-1);
        if (extension === 'csv') {
          const { readCsv } = await import('./csvReader');
          table = readCsv(request.fileBytes);
        }
        else if (extension === 'xlsx') {
          const { readXlsx } = await import('./xlsxReader');
          table = await readXlsx(request.fileBytes);
        }
        else {
          throw new ImportFileError(ImportFileInvalidReason.FORMAT);
        }
      }
      catch (error) {
        if (!(error instanceof ImportFileError)) {
          throw error;
        }
        throw errors.create(ErrorCode.IMPORT_FILE_INVALID, {
          case: 'importFileInvalid', value: create(ImportFileInvalidParamsSchema, {
            columnKey: error.columnKey,
            columnNumber: error.columnNumber,
            limit: BigInt(error.limit),
            reason: error.reason,
            rowNumber: error.rowNumber,
          }),
        });
      }
      return command((transaction) => {
        const caller = guard.guardImportCatalogCall(transaction, ImportService.method.previewImport, request, context.requestHeader);
        return idempotency.run(transaction, {
          handler: () => {
            let rows;
            let columns;
            try {
              columns = readImportColumns(table[0] ?? []);
              rows = mapImportRows(table, transaction, random, caller.organizationId);
            }
            catch (error) {
              if (!(error instanceof ImportFileError)) {
                throw error;
              }
              throw errors.create(ErrorCode.IMPORT_FILE_INVALID, {
                case: 'importFileInvalid', value: create(ImportFileInvalidParamsSchema, {
                  columnKey: error.columnKey, columnNumber: error.columnNumber, reason: error.reason, rowNumber: error.rowNumber,
                }),
              });
            }
            const rowErrors = validateImportRows(rows, transaction, caller.organizationId, validator, columns);
            rows.forEach((row, index) => row.errors.push(...(rowErrors[index] ?? [])));
            const id = random.uuid();
            const now = timestampFromMs(runtime.getWorldTimeMs());
            const job = create(ImportJobSchema, {
              authorUserId: caller.user.id,
              createdAt: now,
              errorCount: rows.reduce((sum, row) => sum + row.errors.length, 0),
              fileName: request.fileName,
              id,
              rowCount: rows.length,
              status: ImportStatus.PREVIEW,
              templateId: request.templateId,
              tenantId: caller.organizationId,
              updatedAt: now,
              version: 1n,
            });
            transaction.put('importJobs', {
              columns, createdPriceListId: '', createdPriceListVersion: 0n, id, job, provenance: [], rows, usedListingIds: [],
            });
            return create(PreviewImportResponseSchema, { job });
          },
          idempotencyKey: request.idempotencyKey,
          method: ImportService.method.previewImport,
          request,
          scope: caller.organizationId,
        });
      });
    },
    rollbackImport: (request, context) => command((transaction) => {
      const caller = guard.guardImportCatalogCall(transaction, ImportService.method.rollbackImport, request, context.requestHeader);
      return idempotency.run(transaction, {
        handler: () => {
          const record = readImportRecord(transaction, errors, request.jobId, caller.organizationId);
          assertVersionOrInitial(errors, EntityKind.IMPORT_JOB, record.job.version, request.expectedVersion);
          assertStatus(record, ImportStatus.COMMITTED);
          rollbackImport(transaction, runtime, record);
          advanceVersion(record);
          transaction.put('importJobs', record);
          return create(RollbackImportResponseSchema, { job: record.job });
        },
        idempotencyKey: request.idempotencyKey,
        method: ImportService.method.rollbackImport,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
