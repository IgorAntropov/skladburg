import type { MessageKey } from '@/shared/i18n';

import { DemoPersonaKind } from '@/shared/api';

export const PERSONA_KIND_MESSAGE_KEYS = {
  [DemoPersonaKind.BUYER]: 'persona.kind.buyer',
  [DemoPersonaKind.CARRIER]: 'persona.kind.carrier',
  [DemoPersonaKind.SELLER]: 'persona.kind.seller',
  [DemoPersonaKind.STOREKEEPER]: 'persona.kind.storekeeper',
} as const satisfies Record<DemoPersonaKind, MessageKey>;
