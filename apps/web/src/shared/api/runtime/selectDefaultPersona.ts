import type { DemoPersonaValue } from '../transport/demo';

export const selectDefaultPersona = (
  personas: readonly DemoPersonaValue[],
  organizationId: string,
): DemoPersonaValue | undefined => {
  let selected: DemoPersonaValue | undefined;

  for (const persona of personas) {
    const isCandidate = persona.organizationId === organizationId;
    const isBeforeSelected = selected === undefined || persona.id < selected.id;

    if (isCandidate && isBeforeSelected) {
      selected = persona;
    }
  }

  return selected;
};
