import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';

interface SavedRequisitesResponseValue {
  requisites?: OrganizationRequisites | undefined;
}

export const readSavedRequisites = (response: SavedRequisitesResponseValue): OrganizationRequisites => {
  if (response.requisites === undefined) {
    throw new TypeError('The server did not return the saved requisites');
  }

  return response.requisites;
};
