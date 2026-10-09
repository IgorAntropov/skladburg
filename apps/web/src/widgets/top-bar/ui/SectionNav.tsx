import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  AddressLink,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

const NAV_LINK_CLASS_NAME = [
  'relative inline-flex min-h-11 items-center px-2 text-base font-medium text-on-panel-muted lg:px-3',
  'motion-safe:transition-colors hover:bg-skeleton hover:text-on-panel',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
  'aria-[current=page]:font-semibold aria-[current=page]:text-on-panel',
  'aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-1.5 aria-[current=page]:after:bottom-0',
  'lg:aria-[current=page]:after:inset-x-2',
  'aria-[current=page]:after:h-[3px] aria-[current=page]:after:rounded-t-full aria-[current=page]:after:bg-indicator',
].join(' ');

interface SectionNavProps {
  currentSection: AppSectionValue | undefined;
  sections: readonly AppSectionValue[];
}

export const SectionNav = ({ currentSection, sections }: SectionNavProps): ReactElement => {
  const { t } = useI18n();

  return (
    <nav aria-label={t('app.nav.label')} className="-my-2 hidden self-stretch sm:flex">
      <ul className="flex gap-0.5">
        {sections.map((section) => {
          const ariaCurrent = section === currentSection ? 'page' : undefined;

          return (
            <li className="flex" key={section}>
              <AddressLink aria-current={ariaCurrent} className={NAV_LINK_CLASS_NAME} to={{ kind: 'section', section }}>
                {t(SECTION_TITLE_KEYS[section])}
              </AddressLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
