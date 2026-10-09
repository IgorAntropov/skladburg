import type { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

export type ProfileSummaryStateValue
  = | { kind: 'error' }
    | { kind: 'pending' }
    | { kind: 'ready'; summary: ProfileSummaryValue };

export interface ProfileSummaryValue {
  organizationId: string;
  organizationName: string;
  sides: readonly ProfileKind[];
  userDisplayName: string;
  userId: string;
}
