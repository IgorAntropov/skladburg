import type { PersonaValue } from './demoData.ts';

import { getText } from './messages.ts';

export const getPersonaLabel = ({ kind, organizationName }: PersonaValue): string => getText('persona.option')
  .replace('{kind}', getText(`persona.kind.${kind}`))
  .replace('{organization}', organizationName);
