import type {
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';

import { create } from '@bufbuild/protobuf';
import {
  OrganizationRequisitesService,
  SignatorySchema,
} from '@skladburg/contracts/organization/v1/requisites';
import { useQueryClient } from '@tanstack/react-query';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import {
  useApiClient,
  useCommand,
} from '@/shared/api';
import { useAnnounce } from '@/shared/ui';

import type {
  RequisitesMessageKeyValue,
  RequisitesTranslate,
} from '../i18n/requisitesSection';

import { readSavedRequisites } from './readSavedRequisites';
import { useRequisitesQueryKey } from './useRequisitesQueryKey';

export interface SignatoryCommandsValue {
  makeDefault: CommandValue;
  remove: CommandValue;
  removeAccess: CommandAccessValue;
  saveAccess: CommandAccessValue;
}

export interface UseSignatoryCommandsOptions {
  onSaved: (requisites: OrganizationRequisites) => void;
  signatoriesVersion: bigint;
  signatory: Signatory;
  t: RequisitesTranslate;
}

type AnnouncementKeyValue = Extract<
  RequisitesMessageKeyValue,
  'requisites.signatories.defaultChanged' | 'requisites.signatories.removed'
>;

export const useSignatoryCommands = ({
  onSaved,
  signatoriesVersion,
  signatory,
  t,
}: UseSignatoryCommandsOptions): SignatoryCommandsValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = useRequisitesQueryKey();
  const announce = useAnnounce();
  const saveAccess = useCommandAccess(OrganizationRequisitesService.method.saveSignatory);
  const removeAccess = useCommandAccess(OrganizationRequisitesService.method.removeSignatory);

  const createSavedHandler = (announcementKey: AnnouncementKeyValue) => (saved: OrganizationRequisites): void => {
    console.log('> useSignatoryCommands -> handleSaved:', { announcementKey, version: String(saved.version) });
    queryClient.setQueryData(queryKey, saved);
    announce(t(announcementKey));
    onSaved(saved);
  };

  const makeDefault = useCommand<OrganizationRequisites>({
    execute: async (idempotencyKey) => {
      const response = await client.service(OrganizationRequisitesService).saveSignatory({
        expectedVersion: signatoriesVersion,
        idempotencyKey,
        signatory: create(SignatorySchema, { ...signatory, isDefault: true }),
      });

      return readSavedRequisites(response);
    },
    method: OrganizationRequisitesService.method.saveSignatory,
    onSuccess: createSavedHandler('requisites.signatories.defaultChanged'),
  });

  const remove = useCommand<OrganizationRequisites>({
    execute: async (idempotencyKey) => {
      const response = await client.service(OrganizationRequisitesService).removeSignatory({
        expectedVersion: signatoriesVersion,
        idempotencyKey,
        signatoryId: signatory.id,
      });

      return readSavedRequisites(response);
    },
    method: OrganizationRequisitesService.method.removeSignatory,
    onSuccess: createSavedHandler('requisites.signatories.removed'),
  });

  return {
    makeDefault,
    remove,
    removeAccess,
    saveAccess,
  };
};
