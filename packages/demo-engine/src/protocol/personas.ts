import type {
  DemoPersonaGroup,
  DemoPersonaKind,
} from './constants';

export interface DemoPersonaListItemValue {
  group: DemoPersonaGroup;
  id: string;
  kind: DemoPersonaKind;
  organizationId: string;
  organizationName: string;
  roleName: string;
  userDisplayName: string;
  userId: string;
}
