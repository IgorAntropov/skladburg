import type { DescMethod } from '@bufbuild/protobuf';

import { ImportService } from '@skladburg/contracts/import/v1/import';

import type { CommandAccessValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';

export const useImportAccess = (method: DescMethod, companion: CommandAccessValue): CommandAccessValue => {
  const access = useCommandAccess(method, { kind: 'organization' });

  return access.status === 'allowed' ? companion : access;
};

export const useImportReadAccess = (companion: CommandAccessValue): CommandAccessValue =>
  useImportAccess(ImportService.method.listImportJobs, companion);
