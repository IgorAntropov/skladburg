import type { ComponentType } from 'react';

import type { PersonaSwitcherProps } from '@/features/switch-persona';

interface PersonaSwitcherModuleValue {
  default: ComponentType<PersonaSwitcherProps>;
}

export const loadPersonaSwitcher = (): Promise<PersonaSwitcherModuleValue> => {
  return import('@/features/switch-persona').then(module => ({ default: module.PersonaSwitcher }));
};
