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
          <DropdownMenuRadioItem key={section} value={section}>
            {t(SECTION_TITLE_KEYS[section])}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
