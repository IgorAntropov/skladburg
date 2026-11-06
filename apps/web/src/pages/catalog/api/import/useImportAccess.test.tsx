import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { ImportService } from '@skladburg/contracts/import/v1/import';
import { QueryClientProvider } from '@tanstack/react-query';
import {
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
import { createTestRuntime } from '@/shared/api/index.testing';

import {
  useImportReadAccess,
  useImportWriteAccess,
} from './useImportQueries';

describe('catalog import access', () => {
  afterEach(cleanup);

  it('allows reading but blocks all import commands without organization-wide price editing', async () => {
    const permissions = ['import_view', 'import_create', 'catalog_view', 'catalog_edit', 'price_list_view']
      .map(permission => ({ isOrganizationWide: true, permission }));
    permissions.push({ isOrganizationWide: false, permission: 'price_list_edit' });
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, {
        getSession: () => create(GetSessionResponseSchema, { permissions }),
      }),
    });
    const queryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(() => ({
      commit: useImportWriteAccess(ImportService.method.commitImport),
      preview: useImportWriteAccess(ImportService.method.previewImport),
      read: useImportReadAccess(),
      rollback: useImportWriteAccess(ImportService.method.rollbackImport),
    }), { wrapper: Wrapper });

    const denied = { permission: 'price_list_edit', status: 'denied' };
    await waitFor(() => {
      expect(result.current).toEqual({ commit: denied, preview: denied, read: { status: 'allowed' }, rollback: denied });
    });
  });
});
