import type {
  DemoPersonaGroup,
  DemoPersonaListItemValue,
} from '@/shared/api';

export interface PersonaGroupValue {
  group: DemoPersonaGroup;
  personas: readonly DemoPersonaListItemValue[];
}

export const groupPersonas = (personas: readonly DemoPersonaListItemValue[]): readonly PersonaGroupValue[] => {
  const personasByGroup = new Map<DemoPersonaGroup, DemoPersonaListItemValue[]>();

  for (const persona of personas) {
    const groupPersonasList = personasByGroup.get(persona.group);

    if (groupPersonasList === undefined) {
      personasByGroup.set(persona.group, [persona]);
    }
    else {
      groupPersonasList.push(persona);
    }
  }

  return Array.from(personasByGroup, ([group, groupedPersonas]) => ({ group, personas: groupedPersonas }));
};
