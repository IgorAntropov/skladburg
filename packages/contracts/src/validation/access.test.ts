import { create } from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ListPermissionsRequestSchema,
  ListRolesRequestSchema,
} from '../gen/access/v1/access_pb';
import { PageRequestSchema } from '../gen/common/v1/page_pb';
import { collectViolations } from './collectViolations';

describe('List requests of the access module', () => {
  it.each([
    ['ListPermissionsRequest', ListPermissionsRequestSchema],
    ['ListRolesRequest', ListRolesRequestSchema],
  ] as const)('accepts %s without a page', (_name, schema) => {
    expect(collectViolations(schema, create(schema))).toEqual([]);
  });

  it.each([
    ['ListPermissionsRequest', ListPermissionsRequestSchema],
    ['ListRolesRequest', ListRolesRequestSchema],
  ] as const)('accepts %s with page size 200', (_name, schema) => {
    const request = create(schema, { page: create(PageRequestSchema, { pageSize: 200 }) });

    expect(collectViolations(schema, request)).toEqual([]);
  });

  it.each([
    ['ListPermissionsRequest', ListPermissionsRequestSchema],
    ['ListRolesRequest', ListRolesRequestSchema],
  ] as const)('rejects %s with page size 201', (_name, schema) => {
    const request = create(schema, { page: create(PageRequestSchema, { pageSize: 201 }) });

    expect(collectViolations(schema, request)).toEqual([
      { fieldPath: 'page.page_size', ruleId: 'int32.gte_lte' },
    ]);
  });
});
