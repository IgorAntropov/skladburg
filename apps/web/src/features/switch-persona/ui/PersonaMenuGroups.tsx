import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import { useDemoControl } from '@/shared/api';

import { groupPersonas } from '../lib/groupPersonas';
import { usePersonaSwitch } from '../model/usePersonaSwitch';
import { PersonaMenuGroup } from './PersonaMenuGroup';
import { PersonaMenuLoadError } from './PersonaMenuLoadError';
import { PersonaMenuSkeleton } from './PersonaMenuSkeleton';

export interface PersonaMenuGroupsProps {
  focusKey: string;
}

export const PersonaMenuGroups = ({ focusKey }: PersonaMenuGroupsProps): null | ReactElement => {
  const demoControl = useDemoControl();
  const {
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
  } = usePersonaSwitch(focusKey);

  const isDemoActive = demoControl !== undefined;
  const groups = useMemo(() => groupPersonas(personas), [personas]);

  const handlePersonaValueChange = (personaId: string): void => {
    console.log('> PersonaMenuGroups -> handlePersonaValueChange:', { personaId });
    void switchToPersona(personaId);
  };

  useEffect(() => {
    if (isDemoActive && isError) {
      console.log('> PersonaMenuGroups -> reportPersonasError:', { error });
    }
  }, [error, isDemoActive, isError]);

  if (!isDemoActive) {
    return null;
  }

  if (isError) {
    return <PersonaMenuLoadError onRetry={retryLoad} />;
  }

  if (isPending) {
    return <PersonaMenuSkeleton />;
  }

  return (
    <>
      {groups.map(group => (
        <PersonaMenuGroup
          currentPersonaId={currentPersona?.id}
          formatPersona={formatPersona}
          formatPersonaSecondLine={formatPersonaSecondLine}
          group={group}
          isSwitching={isSwitching}
          key={group.group}
          onPersonaChange={handlePersonaValueChange}
        />
      ))}
    </>
  );
};
