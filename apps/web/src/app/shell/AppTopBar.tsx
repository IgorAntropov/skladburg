import type { ReactElement } from 'react';

import { useDemoControl } from '@/shared/api';
import {
  getAddressSection,
  useAddress,
} from '@/shared/routing';
import { TopBar } from '@/widgets/top-bar';

import { useAvailableSections } from '../access';
import { PersonaSwitcherSlot } from './PersonaSwitcherSlot';

const NO_SECTIONS: readonly never[] = [];

export const AppTopBar = (): ReactElement => {
  const { address } = useAddress();
  const availableSections = useAvailableSections();
  const demoControl = useDemoControl();

  const isPersonaSwitcherShown = demoControl !== undefined;

  const currentSection = address === undefined ? undefined : getAddressSection(address);
  const sections = availableSections.kind === 'ready' ? availableSections.sections : NO_SECTIONS;

  return (
    <TopBar
      currentSection={currentSection}
      personaSwitcher={isPersonaSwitcherShown ? <PersonaSwitcherSlot /> : undefined}
      sections={sections}
    />
  );
};
