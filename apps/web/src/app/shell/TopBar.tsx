import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  AddressLink,
  APP_SECTIONS,
  useAddress,
} from '@/shared/routing';
import { useTenantSettings } from '@/shared/tenant';

import {
  getAddressSection,
  SECTION_TITLE_KEYS,
} from '../routing/sections';

const NAV_LINK_CLASS_NAME = [
  'inline-flex min-h-11 items-center rounded-md px-3 text-base',
  'hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-panel',
  'aria-[current=page]:bg-primary aria-[current=page]:font-semibold aria-[current=page]:text-on-primary',
].join(' ');

export const TopBar = (): ReactElement => {
  const { t } = useI18n();
  const { brandName } = useTenantSettings();
  const { address } = useAddress();

  const currentSection = address === undefined ? undefined : getAddressSection(address);

  return (
    <header className="bg-panel text-on-panel">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <p className="text-lg font-semibold" translate="no">
          {brandName}
        </p>
        <nav aria-label={t('app.nav.label')}>
          <ul className="flex flex-wrap gap-1">
            {APP_SECTIONS.map((section) => {
              const ariaCurrent = section === currentSection ? 'page' : undefined;

              return (
                <li key={section}>
                  <AddressLink aria-current={ariaCurrent} className={NAV_LINK_CLASS_NAME} to={{ kind: 'section', section }}>
                    {t(SECTION_TITLE_KEYS[section])}
                  </AddressLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
};
