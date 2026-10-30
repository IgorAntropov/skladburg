import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { useIsMutating } from '@tanstack/react-query';

const REQUISITES_MUTATION_KEY = ['command', OrganizationRequisitesService.typeName] as const;

export const useIsRequisitesCommandPending = (): boolean =>
  useIsMutating({ mutationKey: REQUISITES_MUTATION_KEY }) > 0;
