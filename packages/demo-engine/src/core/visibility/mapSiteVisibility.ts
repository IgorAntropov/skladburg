import { create } from '@bufbuild/protobuf';
import {
  type MapSite,
  MapSiteKind,
  MapSiteSchema,
} from '@skladburg/contracts/network/v1/network';
import {
  type Organization,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../state/index';

import { compareIds } from '../state/index';
import { isOrganizationVerified } from './organizationVisibility';

const PROFILE_KIND_PRIORITY: readonly ProfileKind[] = [ProfileKind.SUPPLIER, ProfileKind.CUSTOMER, ProfileKind.CARRIER];

export const resolveMapSiteProfileKind = (organization: Organization): ProfileKind =>
  PROFILE_KIND_PRIORITY.find(kind => organization.profiles.some(profile => profile.kind === kind)) ?? ProfileKind.UNSPECIFIED;

export const listVisibleMapSites = (read: IStateReader, viewerOrganizationId: string): MapSite[] => {
  const viewer = read.get('organizations', viewerOrganizationId);
  const isViewerVerified = viewer !== undefined && isOrganizationVerified(viewer);
  const sites: MapSite[] = [];

  for (const warehouse of read.list('warehouses')) {
    const owner = read.get('organizations', warehouse.tenantId);
    const isOwn = warehouse.tenantId === viewerOrganizationId;
    const isShowcaseVisible = isViewerVerified && owner !== undefined && isOrganizationVerified(owner);

    if (owner !== undefined && (isOwn || isShowcaseVisible)) {
      sites.push(create(MapSiteSchema, {
        cityId: warehouse.cityId,
        id: warehouse.id,
        kind: MapSiteKind.WAREHOUSE,
        mapNodeId: warehouse.mapNodeId,
        name: isOwn ? warehouse.name : '',
        organizationId: owner.id,
        organizationName: owner.name,
        profileKind: resolveMapSiteProfileKind(owner),
      }));
    }
  }

  return sites.sort((current, prev) => compareIds(current.id, prev.id));
};
