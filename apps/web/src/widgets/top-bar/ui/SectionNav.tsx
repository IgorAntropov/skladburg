import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  AddressLink,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

const NAV_LABEL_CLASS_NAME = [
  'inline-block',
  'after:invisible after:block after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]',
].join(' ');

const NAV_LINK_CLASS_NAME = [
  'relative inline-flex min-h-11 touch-manipulation items-center px-2 text-base font-medium text-on-panel-muted lg:px-3',
  'motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-out',
  'hover:bg-hover hover:text-on-panel active:bg-line active:text-on-panel',
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
          const title = t(SECTION_TITLE_KEYS[section]);

          return (
            <li className="flex" key={section}>
              <AddressLink aria-current={ariaCurrent} className={NAV_LINK_CLASS_NAME} to={{ kind: 'section', section }}>
                <span className={NAV_LABEL_CLASS_NAME} data-label={title}>{title}</span>
              </AddressLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
