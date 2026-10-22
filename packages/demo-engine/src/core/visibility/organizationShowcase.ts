import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  type Organization,
  OrganizationProfileSchema,
  ProfileKind,
  type Sphere,
} from '@skladburg/contracts/organization/v1/organization';
import {
  type OrganizationShowcase,
  OrganizationShowcaseSchema,
} from '@skladburg/contracts/organization/v1/showcase';

import type { IStateReader } from '../state/index';

import { compareIds } from '../state/index';
import { isOrganizationVisibleToViewer } from './organizationVisibility';

export interface OrganizationShowcaseFilterValue {
  minVerificationLevel: number;
  profileKind: ProfileKind;
  sphereId: string;
}

const NAME_COLLATOR = new Intl.Collator('ru', { sensitivity: 'base' });

export const projectOrganizationShowcase = (organization: Organization): OrganizationShowcase => create(OrganizationShowcaseSchema, {
  id: organization.id,
  name: organization.name,
  profiles: organization.profiles.map(profile => clone(OrganizationProfileSchema, profile)),
  sphereIds: [...organization.sphereIds],
});

export const collectSphereSubtreeIds = (spheres: readonly Sphere[], rootSphereId: string): ReadonlySet<string> => {
  const subtree = new Set<string>();

  if (!spheres.some(sphere => sphere.id === rootSphereId)) {
    return subtree;
  }

  const pending = [rootSphereId];

  while (pending.length > 0) {
    const currentId = pending.pop();

    if (currentId !== undefined && !subtree.has(currentId)) {
      subtree.add(currentId);
      pending.push(...spheres.filter(sphere => sphere.parentId === currentId).map(sphere => sphere.id));
    }
  }

  return subtree;
};

const matchesProfile = (organization: Organization, filter: OrganizationShowcaseFilterValue): boolean =>
  organization.profiles.some(profile =>
    (filter.profileKind === ProfileKind.UNSPECIFIED || profile.kind === filter.profileKind)
    && profile.verificationLevel >= filter.minVerificationLevel);

const matchesSphere = (organization: Organization, sphereIds: ReadonlySet<string> | undefined): boolean =>
  sphereIds === undefined || organization.sphereIds.some(sphereId => sphereIds.has(sphereId));

const compareShowcases = (current: OrganizationShowcase, next: OrganizationShowcase): number =>
  NAME_COLLATOR.compare(current.name, next.name) || compareIds(current.id, next.id);

export const listVisibleOrganizationShowcases = (
  read: IStateReader,
  viewerOrganizationId: string,
  filter: OrganizationShowcaseFilterValue,
): OrganizationShowcase[] => {
  const sphereIds = filter.sphereId === '' ? undefined : collectSphereSubtreeIds(read.list('spheres'), filter.sphereId);

  return read.list('organizations')
    .filter(organization =>
      isOrganizationVisibleToViewer(read, viewerOrganizationId, organization)
      && matchesSphere(organization, sphereIds)
      && matchesProfile(organization, filter))
    .map(projectOrganizationShowcase)
    .sort(compareShowcases);
};

export const getVisibleOrganizationShowcase = (
  read: IStateReader,
  viewerOrganizationId: string,
  targetOrganizationId: string,
): OrganizationShowcase | undefined => {
  const target = read.get('organizations', targetOrganizationId);

  return target !== undefined && isOrganizationVisibleToViewer(read, viewerOrganizationId, target)
    ? projectOrganizationShowcase(target)
    : undefined;
};
