import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { AppSectionValue } from '@/shared/routing';

import { APP_SECTIONS } from '@/shared/routing';

import type { SectionAccessRuleValue } from '../model/sectionAccessRules';

import { SECTION_ACCESS_RULES } from '../model/sectionAccessRules';

interface SessionAccessValue {
  hasOrganizationWideRole: boolean;
  permissionNames: ReadonlySet<string>;
  profileKinds: ReadonlySet<ProfileKind>;
}

const readSessionAccess = (session: GetSessionResponse): SessionAccessValue => {
  const actingOrganization = session.organizations.find(organization => organization.id === session.actingOrganizationId);

  return {
    hasOrganizationWideRole: session.permissions.some(permission => permission.isOrganizationWide),
    permissionNames: new Set(session.permissions.map(permission => permission.permission)),
    profileKinds: new Set(actingOrganization?.profiles.map(profile => profile.kind)),
  };
};

const isSectionAllowed = (rule: SectionAccessRuleValue, access: SessionAccessValue): boolean => {
  const hasProfile = rule.profiles.some(kind => access.profileKinds.has(kind));
  const hasPermission = rule.permission === undefined || access.permissionNames.has(rule.permission);
  const hasRole = !rule.isOrganizationWideRoleRequired || access.hasOrganizationWideRole;

  return hasProfile && hasPermission && hasRole;
};

export const resolveAvailableSections = (session: GetSessionResponse): readonly AppSectionValue[] => {
  const access = readSessionAccess(session);

  return APP_SECTIONS.filter(section => isSectionAllowed(SECTION_ACCESS_RULES[section], access));
};
