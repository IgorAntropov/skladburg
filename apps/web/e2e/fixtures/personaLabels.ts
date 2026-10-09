import type {
  PersonaGroupValue,
  PersonaSideValue,
  PersonaValue,
} from './demoData.ts';

import { getText } from './messages.ts';

const GROUP_LABEL_KEYS = {
  construction: 'persona.group.construction',
  fresh: 'persona.group.fresh',
} as const satisfies Record<PersonaGroupValue, 'persona.group.construction' | 'persona.group.fresh'>;

const SIDE_LABEL_KEYS = {
  buyer: 'side.buyer',
  carrier: 'side.carrier',
  seller: 'side.seller',
} as const satisfies Record<PersonaSideValue, 'side.buyer' | 'side.carrier' | 'side.seller'>;

export const getPersonaLabel = ({ organizationName, roleName, userDisplayName }: PersonaValue): string => getText('persona.option')
  .replace('{name}', userDisplayName)
  .replace('{role}', roleName)
  .replace('{organization}', organizationName);

export const getPersonaSecondLine = ({ organizationName, roleName }: PersonaValue): string => getText('persona.secondLine')
  .replace('{role}', roleName)
  .replace('{organization}', organizationName);

export const getProfileButtonLabel = ({ organizationName, userDisplayName }: PersonaValue): string => getText('profile.button.label')
  .replace('{name}', userDisplayName)
  .replace('{organization}', organizationName);

export const getGroupTitle = (group: PersonaGroupValue): string => getText(GROUP_LABEL_KEYS[group]);

export const getGroupLabel = (group: PersonaGroupValue): string => getText('persona.group.label')
  .replace('{group}', getGroupTitle(group));

export const getSideLabel = ({ side }: PersonaValue): string => getText(SIDE_LABEL_KEYS[side]);
