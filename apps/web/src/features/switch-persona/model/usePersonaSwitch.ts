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
import { findCurrentPersona } from '../lib/findCurrentPersona';

export interface PersonaSwitchValue {
  currentPersona: DemoPersonaListItemValue | undefined;
  error: Error | null;
  formatPersona: (persona: DemoPersonaListItemValue) => string;
  formatPersonaSecondLine: (persona: DemoPersonaListItemValue) => string;
  isError: boolean;
  isPending: boolean;
  isSwitching: boolean;
  personas: readonly DemoPersonaListItemValue[];
  retryLoad: () => void;
  switchToPersona: (personaId: string) => Promise<void>;
}

const INTERNAL_ERROR_MESSAGE_KEY = 'error.internal';
const NO_PERSONAS: readonly DemoPersonaListItemValue[] = [];

export const usePersonaSwitch = (focusKey: string): PersonaSwitchValue => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const { cancelFocus, requestFocus } = useFocusHandoff<HTMLButtonElement>(focusKey);
  const {
    data: personas = NO_PERSONAS,
    error,
    isError,
    isPending,
    refetch,
  } = usePersonasQuery();
  const actingContext = useActingContext();
  const { isSwitching, switchActingContext } = useSwitchActingContext();

  const currentPersona = findCurrentPersona(personas, actingContext);

  const formatPersona = useCallback((persona: DemoPersonaListItemValue): string => {
    if (persona.roleName === '') {
      return t('persona.optionWithoutRole', {
        name: persona.userDisplayName,
        organization: persona.organizationName,
      });
    }

    return t('persona.option', {
      name: persona.userDisplayName,
      organization: persona.organizationName,
      role: persona.roleName,
    });
  }, [t]);

  const formatPersonaSecondLine = useCallback((persona: DemoPersonaListItemValue): string => {
    if (persona.roleName === '') {
      return persona.organizationName;
    }

    return t('persona.secondLine', {
      organization: persona.organizationName,
      role: persona.roleName,
    });
  }, [t]);

  const describeSwitchError = useCallback((switchError: unknown): string => {
    const apiError = parseApiError(switchError);

    return getErrorMessageKey(apiError.code) === INTERNAL_ERROR_MESSAGE_KEY
      ? t('persona.switchError')
      : translateApiError(t, apiError);
  }, [t]);

  const retryLoad = useCallback((): void => {
    console.log('> usePersonaSwitch -> retryLoad:', { focusKey });
    void refetch();
  }, [focusKey, refetch]);

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
    formatPersonaSecondLine,
    isError,
    isPending,
    isSwitching,
    personas,
    retryLoad,
    switchToPersona,
  };
};
