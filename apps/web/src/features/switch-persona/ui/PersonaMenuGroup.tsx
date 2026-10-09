import type { ReactElement } from 'react';

import type { DemoPersonaListItemValue } from '@/shared/api';

import { useI18n } from '@/shared/i18n';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
} from '@/shared/ui';

import type { PersonaGroupValue } from '../lib/groupPersonas';

import { PERSONA_GROUP_MESSAGE_KEYS } from '../model/personaGroupMessageKeys';
import { PersonaMenuItem } from './PersonaMenuItem';

interface PersonaMenuGroupProps {
  currentPersonaId: string | undefined;
  formatPersona: (persona: DemoPersonaListItemValue) => string;
  formatPersonaSecondLine: (persona: DemoPersonaListItemValue) => string;
  group: PersonaGroupValue;
  isSwitching: boolean;
  onPersonaChange: (personaId: string) => void;
}

export const PersonaMenuGroup = ({
  currentPersonaId,
  formatPersona,
  formatPersonaSecondLine,
  group,
  isSwitching,
  onPersonaChange,
}: PersonaMenuGroupProps): ReactElement => {
  const { t } = useI18n();

  const groupTitle = t(PERSONA_GROUP_MESSAGE_KEYS[group.group]);
  const checkedPersonaId = group.personas.find(persona => persona.id === currentPersonaId)?.id;

  return (
    <>
      <DropdownMenuLabel>{groupTitle}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        label={t('persona.group.label', { group: groupTitle })}
        onValueChange={onPersonaChange}
        value={checkedPersonaId}
      >
        {group.personas.map(persona => (
          <PersonaMenuItem
            isDisabled={isSwitching}
            key={persona.id}
            label={formatPersona(persona)}
            persona={persona}
            secondLine={formatPersonaSecondLine(persona)}
          />
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
