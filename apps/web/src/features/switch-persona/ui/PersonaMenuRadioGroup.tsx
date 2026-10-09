import type { ReactElement } from 'react';

import { useDemoControl } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui';

import { usePersonaSwitch } from '../model/usePersonaSwitch';

export interface PersonaMenuRadioGroupProps {
  focusKey: string;
}

export const PersonaMenuRadioGroup = ({ focusKey }: PersonaMenuRadioGroupProps): null | ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const {
    currentPersona,
    formatPersona,
    isError,
    isSwitching,
    personas,
    switchToPersona,
  } = usePersonaSwitch(focusKey);

  const isGroupVisible = demoControl !== undefined && !isError;

  const handlePersonaValueChange = (personaId: string): void => {
    console.log('> PersonaMenuRadioGroup -> handlePersonaValueChange:', { personaId });
    void switchToPersona(personaId);
  };

  if (!isGroupVisible) {
    return null;
  }

  return (
    <>
      <DropdownMenuLabel>{t('persona.label')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        label={t('persona.menu.label')}
        onValueChange={handlePersonaValueChange}
        value={currentPersona?.id}
      >
        {personas.map(persona => (
          <DropdownMenuRadioItem disabled={isSwitching} key={persona.id} value={persona.id}>
            {formatPersona(persona)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
