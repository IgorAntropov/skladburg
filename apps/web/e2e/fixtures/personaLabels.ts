import type { PersonaValue } from './demoData.ts';

import { getText } from './messages.ts';

export const getPersonaLabel = ({ organizationName, roleName, userDisplayName }: PersonaValue): string => getText('persona.option')
  .replace('{name}', userDisplayName)
  .replace('{role}', roleName)
  .replace('{organization}', organizationName);

export const getProfileButtonLabel = ({ organizationName, userDisplayName }: PersonaValue): string => getText('profile.button.label')
  .replace('{name}', userDisplayName)
  .replace('{organization}', organizationName);
