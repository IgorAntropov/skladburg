import type { MessageKey } from '@/shared/i18n';

import { DemoPersonaGroup } from '@/shared/api';

export const PERSONA_GROUP_MESSAGE_KEYS = {
  [DemoPersonaGroup.CONSTRUCTION]: 'persona.group.construction',
  [DemoPersonaGroup.FRESH]: 'persona.group.fresh',
} as const satisfies Record<DemoPersonaGroup, MessageKey>;
