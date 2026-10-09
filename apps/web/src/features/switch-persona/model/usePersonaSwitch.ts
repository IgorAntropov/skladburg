import type { RefCallback } from 'react';

import { useCallback } from 'react';

import type { DemoPersonaListItemValue } from '@/shared/api';

import {
  getErrorMessageKey,
  parseApiError,
  translateApiError,
  useActingContext,
  useSwitchActingContext,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  useAnnounce,
  useFocusHandoff,
} from '@/shared/ui';

import { usePersonasQuery } from '../api/usePersonasQuery';
import { PERSONA_KIND_MESSAGE_KEYS } from './personaKindMessageKeys';

export interface PersonaSwitchValue {
  currentPersona: DemoPersonaListItemValue | undefined;
  error: Error | null;
  formatPersona: (persona: DemoPersonaListItemValue) => string;
  isError: boolean;
  isPending: boolean;
  isSwitching: boolean;
  personas: readonly DemoPersonaListItemValue[];
  switchToPersona: (personaId: string) => Promise<void>;
  triggerRef: RefCallback<HTMLButtonElement> | undefined;
}

const INTERNAL_ERROR_MESSAGE_KEY = 'error.internal';
const NO_PERSONAS: readonly DemoPersonaListItemValue[] = [];

export const usePersonaSwitch = (focusKey: string): PersonaSwitchValue => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const {
    cancelFocus,
    ref: handoffRef,
    requestFocus,
  } = useFocusHandoff<HTMLButtonElement>(focusKey);
  const {
    data: personas = NO_PERSONAS,
    error,
    isError,
    isPending,
  } = usePersonasQuery();
  const { organizationId, userId } = useActingContext();
  const { isSwitching, switchActingContext } = useSwitchActingContext();

  const currentPersona = personas.find(persona => persona.organizationId === organizationId && persona.userId === userId);

  const formatPersona = useCallback((persona: DemoPersonaListItemValue): string => t('persona.option', {
    kind: t(PERSONA_KIND_MESSAGE_KEYS[persona.kind]),
    organization: persona.organizationName,
  }), [t]);

  const describeSwitchError = useCallback((switchError: unknown): string => {
    const apiError = parseApiError(switchError);

    return getErrorMessageKey(apiError.code) === INTERNAL_ERROR_MESSAGE_KEY
      ? t('persona.switchError')
      : translateApiError(t, apiError);
  }, [t]);

  const switchToPersona = useCallback(async (personaId: string): Promise<void> => {
    console.log('> usePersonaSwitch -> switchToPersona:', { focusKey, personaId });
    const persona = personas.find(candidate => candidate.id === personaId);

    if (persona === undefined || persona.id === currentPersona?.id || isSwitching) {
      return;
    }

    requestFocus();
    announce(t('persona.switching'));

    try {
      await switchActingContext({ organizationId: persona.organizationId, userId: persona.userId });
    }
    catch (switchError: unknown) {
      console.log('> usePersonaSwitch -> switchToPersona:', { personaId, switchError });
      cancelFocus();
      announce(describeSwitchError(switchError));

      return;
    }

    announce(t('persona.switched', { persona: formatPersona(persona) }));
  }, [
    announce,
    cancelFocus,
    currentPersona?.id,
    describeSwitchError,
    focusKey,
    formatPersona,
    isSwitching,
    personas,
    requestFocus,
    switchActingContext,
    t,
  ]);

  return {
    currentPersona,
    error,
    formatPersona,
    isError,
    isPending,
    isSwitching,
    personas,
    switchToPersona,
    triggerRef: isPending ? undefined : handoffRef,
  };
};
