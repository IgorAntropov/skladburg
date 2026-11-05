import {
  create,
  toJsonString,
} from '@bufbuild/protobuf';
import {
  GetImportJobResponseSchema,
  ImportJobSchema,
  ImportRowSchema,
} from '@skladburg/contracts/import/v1/import';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ImportRecordValue } from './importRecords';

import { createDomainErrors } from '../../errors/index';
import { createSeededRandom } from '../../ports/index';
import { paginateImportRows } from './importJobHandlers';

describe('import row response limits', () => {
  it('bounds JSON and binary pages and advances the token when escaped values expand', () => {
    const errors = createDomainErrors(createSeededRandom(1));
    const record: ImportRecordValue = {
      columns: [], createdPriceListId: '', createdPriceListVersion: 0n, id: 'job', job: create(ImportJobSchema), provenance: [],
      rows: Array.from({ length: 20 }, (_, index) => create(ImportRowSchema, {
        rowNumber: index + 2, values: Array.from({ length: 32 }, () => '\u0001'.repeat(4096)),
      })), usedListingIds: [],
    };
    const first = paginateImportRows(record, undefined, false, errors);
    const response = create(GetImportJobResponseSchema, { job: record.job, page: first.page, rows: first.items });
    expect(new TextEncoder().encode(toJsonString(GetImportJobResponseSchema, response)).length).toBeLessThan(4 * 1024 * 1024);
    expect(first.items.length).toBeGreaterThan(0);
    expect(first.items.length).toBeLessThan(record.rows.length);
    const second = paginateImportRows(record, {
      $typeName: 'common.v1.PageRequest', pageSize: 100, pageToken: first.page.nextPageToken,
    }, false, errors);
    expect(second.items[0]?.rowNumber).toBe((first.items.at(-1)?.rowNumber ?? 0) + 1);
  });
});
