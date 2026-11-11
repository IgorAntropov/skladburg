import type { PageRequest } from '@skladburg/contracts/common/v1/page';
import type {
  ImportRow,
  WarehouseImportScope,
} from '@skladburg/contracts/import/v1/import';

import {
  create,
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { PageRequestSchema } from '@skladburg/contracts/common/v1/page';
import { ImportRowSchema } from '@skladburg/contracts/import/v1/import';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';
import type { PageValue } from '../pagination';
import type { ImportRecordValue } from './importRecords';

import { paginate } from '../pagination';

export const isImportInScope = (
  record: ImportRecordValue,
  scope: undefined | WarehouseImportScope,
): boolean => record.job.warehouseId === scope?.warehouseId && record.job.templateId === (scope?.templateId ?? 'catalog');

export const readImportRecord = (
  reader: IStateReader,
  errors: IDomainErrors,
  id: string,
  organizationId: string,
  scope: undefined | WarehouseImportScope,
): ImportRecordValue => {
  const record = reader.get('importJobs', id);
  if (record?.job.tenantId !== organizationId || !isImportInScope(record, scope)) {
    throw errors.notFound(EntityKind.IMPORT_JOB);
  }
  return record;
};

export const boundedImportPage = (page: PageRequest | undefined): PageRequest => create(PageRequestSchema, {
  pageSize: Math.min((page?.pageSize === undefined || page.pageSize === 0 ? 100 : page.pageSize), 100), pageToken: page?.pageToken ?? '',
});

export const paginateImportRows = (
  record: ImportRecordValue,
  page: PageRequest | undefined,
  hasErrorsOnly: boolean,
  errors: IDomainErrors,
): PageValue<ImportRow> => {
  const rows = record.rows.filter(row => !hasErrorsOnly || row.errors.length > 0);
  const result = paginate(rows, row => String(row.rowNumber), boundedImportPage(page), errors);
  let bytes = 0;
  let jsonBytes = 0;
  const encoder = new TextEncoder();
  const items: ImportRow[] = [];
  for (const row of result.items) {
    const visible = row.errors.length === 0
      ? row
      : create(ImportRowSchema, {
          errors: row.errors, rowNumber: row.rowNumber, values: row.values,
        });
    const size = toBinary(ImportRowSchema, visible).length;
    const jsonSize = encoder.encode(toJsonString(ImportRowSchema, visible)).length;
    if (bytes + size > 2 * 1024 * 1024 || jsonBytes + jsonSize > 2 * 1024 * 1024) {
      break;
    }
    items.push(visible);
    bytes += size;
    jsonBytes += jsonSize;
  }
  if (items.length < result.items.length) {
    result.page.nextPageToken = String(items.at(-1)?.rowNumber ?? '');
  }

  return { items, page: result.page };
};
