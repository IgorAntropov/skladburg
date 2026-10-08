import type { ActingContextValue } from '../context/actingContextTypes';
import type { DemoPersonaListItemValue } from '../transport/demo';

export interface InitialPersonaPreferenceValue {
  defaultOrganizationId: string;
  preferredContext: ActingContextValue | undefined;
  preferredPersonaId: string | undefined;
}

const selectOrganizationPersona = (
  personas: readonly DemoPersonaListItemValue[],
  organizationId: string,
): DemoPersonaListItemValue | undefined => {
  let selected: DemoPersonaListItemValue | undefined;

  for (const persona of personas) {
    const isCandidate = persona.organizationId === organizationId;
    const isBeforeSelected = selected === undefined || persona.id < selected.id;

    if (isCandidate && isBeforeSelected) {
      selected = persona;
    }
  }

  return selected;
};

export const selectInitialPersona = (
  personas: readonly DemoPersonaListItemValue[],
  preference: InitialPersonaPreferenceValue,
): DemoPersonaListItemValue | undefined => {
  const { defaultOrganizationId, preferredContext, preferredPersonaId } = preference;

  const preferredById = preferredPersonaId === undefined
    ? undefined
    : personas.find(persona => persona.id === preferredPersonaId);

  if (preferredById !== undefined) {
    return preferredById;
  }

  const preferredByContext = preferredContext === undefined
    ? undefined
    : personas.find(persona => (
        persona.organizationId === preferredContext.organizationId && persona.userId === preferredContext.userId
      ));

  return preferredByContext ?? selectOrganizationPersona(personas, defaultOrganizationId);
};
