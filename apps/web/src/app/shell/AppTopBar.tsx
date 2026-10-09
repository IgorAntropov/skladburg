import type { ReactElement } from 'react';

import {
  getAddressSection,
  useAddress,
} from '@/shared/routing';
import { ProfileMenuLauncher } from '@/widgets/profile-menu';
import { TopBar } from '@/widgets/top-bar';

import { useAvailableSections } from '../access';

const NO_SECTIONS: readonly never[] = [];

export const AppTopBar = (): ReactElement => {
  const { address } = useAddress();
  const availableSections = useAvailableSections();

  const currentSection = address === undefined ? undefined : getAddressSection(address);
  const sections = availableSections.kind === 'ready' ? availableSections.sections : NO_SECTIONS;

  return (
    <TopBar
      currentSection={currentSection}
      profileMenu={<ProfileMenuLauncher currentSection={currentSection} sections={sections} />}
      sections={sections}
    />
  );
};
