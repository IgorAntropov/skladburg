import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  SECTION_TITLE_KEYS,
  useNavigate,
} from '@/shared/routing';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui';

const SECTION_LABEL_CLASS_NAME = [
  'relative in-aria-checked:font-semibold',
  'in-aria-checked:after:absolute in-aria-checked:after:inset-x-0 in-aria-checked:after:-bottom-1.5',
  'in-aria-checked:after:h-[3px] in-aria-checked:after:rounded-full in-aria-checked:after:bg-indicator',
].join(' ');

interface ProfileSectionsProps {
  currentSection: AppSectionValue | undefined;
  sections: readonly AppSectionValue[];
}

export const ProfileSections = ({ currentSection, sections }: ProfileSectionsProps): ReactElement => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSectionChange = (section: AppSectionValue): void => {
    console.log('> ProfileSections -> handleSectionChange:', { section });
    if (section === currentSection) {
      return;
    }
    navigate({ kind: 'section', section });
  };

  return (
    <>
      <DropdownMenuLabel>{t('app.nav.label')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup label={t('app.nav.label')} onValueChange={handleSectionChange} value={currentSection}>
        {sections.map(section => (
          <DropdownMenuRadioItem indicatorPlacement="none" key={section} value={section}>
            <span className={SECTION_LABEL_CLASS_NAME}>{t(SECTION_TITLE_KEYS[section])}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
