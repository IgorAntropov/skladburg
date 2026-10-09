import type {
  ActingContextValue,
  DemoPersonaListItemValue,
} from '@/shared/api';

export const findCurrentPersona = (
  personas: readonly DemoPersonaListItemValue[],
  { organizationId, userId }: ActingContextValue,
): DemoPersonaListItemValue | undefined => {
  return personas.find(persona => persona.organizationId === organizationId && persona.userId === userId);
};
