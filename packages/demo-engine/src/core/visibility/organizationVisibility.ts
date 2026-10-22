import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  type Organization,
  OrganizationProfileSchema,
  OrganizationSchema,
} from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../state/index';

export const MIN_SHOWCASE_VERIFICATION_LEVEL = 1;

export const isOrganizationVerified = (organization: Organization): boolean =>
  organization.profiles.some(profile => profile.verificationLevel >= MIN_SHOWCASE_VERIFICATION_LEVEL);

export const projectOrganizationForShowcase = (organization: Organization): Organization => create(OrganizationSchema, {
  id: organization.id,
  name: organization.name,
  profiles: organization.profiles.map(profile => clone(OrganizationProfileSchema, profile)),
  sphereIds: [...organization.sphereIds],
});

export const isOrganizationVisibleToViewer = (
  read: IStateReader,
  viewerOrganizationId: string,
  target: Organization,
): boolean => {
  if (viewerOrganizationId === target.id) {
    return true;
  }

  const viewer = read.get('organizations', viewerOrganizationId);

  return viewer !== undefined && isOrganizationVerified(viewer) && isOrganizationVerified(target);
};

export const getVisibleOrganization = (
  read: IStateReader,
  viewerOrganizationId: string,
  targetOrganizationId: string,
): Organization | undefined => {
  const target = read.get('organizations', targetOrganizationId);

  if (target === undefined || viewerOrganizationId === targetOrganizationId) {
    return target;
  }

  return isOrganizationVisibleToViewer(read, viewerOrganizationId, target) ? projectOrganizationForShowcase(target) : undefined;
};
