import type { Signatory } from '@skladburg/contracts/organization/v1/requisites';
import type { ReactElement } from 'react';

import { SignatoryBasis } from '@skladburg/contracts/organization/v1/requisites';
import { useId } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';

import {
  REQUISITES_GROUP_CLASS_NAME,
  REQUISITES_GROUP_HEADING_CLASS_NAME,
  REQUISITES_READ_ONLY_BLOCK_CLASS_NAME,
} from './requisitesStyles';

const ITEM_CLASS_NAME = cn(REQUISITES_READ_ONLY_BLOCK_CLASS_NAME, 'flex flex-col gap-1');

const DEFAULT_BADGE_CLASS_NAME = [
  'inline-flex shrink-0 items-center rounded-full border border-transparent bg-hover px-2.5 py-0.5',
  'text-sm leading-5 font-medium text-on-panel',
].join(' ');

export interface RequisitesSignatoriesListProps {
  signatories: readonly Signatory[];
  t: RequisitesTranslate;
}

interface SignatoryItemProps {
  signatory: Signatory;
  t: RequisitesTranslate;
}

const SignatoryItem = ({ signatory, t }: SignatoryItemProps): ReactElement => {
  const { formatCalendarDate } = useI18n();

  const isPowerOfAttorney = signatory.basis === SignatoryBasis.POWER_OF_ATTORNEY;
  const { powerOfAttorneyDate } = signatory;
  const powerOfAttorneyText = isPowerOfAttorney && signatory.powerOfAttorneyNumber !== '' && powerOfAttorneyDate !== undefined
    ? t('requisites.signatories.powerOfAttorney', {
        date: formatCalendarDate(powerOfAttorneyDate),
        number: signatory.powerOfAttorneyNumber,
      })
    : undefined;
  const basisText = isPowerOfAttorney
    ? t('requisites.signatories.basis.powerOfAttorney')
    : t('requisites.signatories.basis.charter');

  return (
    <li className={ITEM_CLASS_NAME} data-testid={`requisites-signatory-${signatory.id}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 text-base leading-6 font-medium wrap-break-word text-on-panel">{signatory.fullName}</span>
        {signatory.isDefault && (
          <span className={DEFAULT_BADGE_CLASS_NAME}>
            {t('requisites.signatories.default')}
          </span>
        )}
      </div>
      <span className="text-sm leading-5 wrap-break-word text-on-panel-muted">{signatory.position}</span>
      <span className="text-sm leading-5 wrap-break-word text-on-panel-muted">{powerOfAttorneyText ?? basisText}</span>
    </li>
  );
};

export const RequisitesSignatoriesList = ({ signatories, t }: RequisitesSignatoriesListProps): ReactElement => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={REQUISITES_GROUP_CLASS_NAME} data-testid="requisites-signatories">
      <h3 className={REQUISITES_GROUP_HEADING_CLASS_NAME} id={headingId}>
        {t('requisites.signatories.title')}
      </h3>
      {signatories.length === 0
        ? <p className="text-sm leading-5 text-on-panel-muted">{t('requisites.signatories.empty')}</p>
        : (
            <ul className="flex flex-col gap-3">
              {signatories.map(signatory => <SignatoryItem key={signatory.id} signatory={signatory} t={t} />)}
            </ul>
          )}
    </section>
  );
};
