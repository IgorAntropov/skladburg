import type { DemoPersonaListItemValue } from '@/shared/api';

import {
  useActingContext,
  useDemoControl,
} from '@/shared/api';

import { usePersonasQuery } from '../api/usePersonasQuery';
import { findCurrentPersona } from '../lib/findCurrentPersona';

export interface CurrentPersonaValue {
  isPending: boolean;
  persona: DemoPersonaListItemValue | undefined;
}

const NO_PERSONAS: readonly DemoPersonaListItemValue[] = [];

export const useCurrentPersona = (): CurrentPersonaValue => {
  const demoControl = useDemoControl();
  const { data: personas = NO_PERSONAS, isPending } = usePersonasQuery();
  const actingContext = useActingContext();

  return {
    isPending: demoControl !== undefined && isPending,
    persona: findCurrentPersona(personas, actingContext),
  };
};
