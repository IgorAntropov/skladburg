import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import {
  useEffect,
  useId,
} from 'react';

import {
  useActingContext,
  useDemoControl,
  useSwitchActingContext,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { usePersonasQuery } from '../api/usePersonasQuery';
import { PERSONA_KIND_MESSAGE_KEYS } from '../model/personaKindMessageKeys';

const SELECT_CLASS_NAME = [
  'min-h-11 w-64 max-w-full rounded-md border border-line-strong bg-panel-solid px-3 text-base text-on-panel',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'disabled:opacity-60',
].join(' ');

export const PersonaSwitcher = (): null | ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const {
    data: personas = [],
    error,
    isError,
    isPending,
  } = usePersonasQuery();
  const { organizationId, userId } = useActingContext();
  const { isSwitching, switchActingContext } = useSwitchActingContext();
  const selectId = useId();

  const isDemoActive = demoControl !== undefined;
  const isSwitcherVisible = isDemoActive && !isError;
  const isSelectDisabled = isPending || isSwitching;
  const currentPersona = personas.find(persona => persona.organizationId === organizationId && persona.userId === userId);
  const switchingStatus = isSwitching ? t('persona.switching') : '';

  const handlePersonaChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const personaId = event.target.value;

    console.log('> PersonaSwitcher -> handlePersonaChange:', { personaId });
    const persona = personas.find(item => item.id === personaId);

    if (persona === undefined) {
      return;
    }

    switchActingContext({ organizationId: persona.organizationId, userId: persona.userId }).catch((switchError: unknown) => {
      console.log('> PersonaSwitcher -> handlePersonaChange:', { personaId, switchError });
    });
  };

  useEffect(() => {
    if (isDemoActive && isError) {
      console.log('> PersonaSwitcher -> reportPersonasError:', { error });
    }
  }, [error, isDemoActive, isError]);

  if (!isSwitcherVisible) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-base" htmlFor={selectId}>
        {t('persona.label')}
      </label>
      <select
        aria-busy={isSelectDisabled}
        className={SELECT_CLASS_NAME}
        disabled={isSelectDisabled}
        id={selectId}
        onChange={handlePersonaChange}
        value={currentPersona?.id ?? ''}
      >
        {personas.map(persona => (
          <option key={persona.id} value={persona.id}>
            {t('persona.option', {
              kind: t(PERSONA_KIND_MESSAGE_KEYS[persona.kind]),
              organization: persona.organizationName,
            })}
          </option>
        ))}
      </select>
      <span className="sr-only" role="status">
        {switchingStatus}
      </span>
    </div>
  );
};
