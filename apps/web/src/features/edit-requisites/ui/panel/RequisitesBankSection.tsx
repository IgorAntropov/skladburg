import type { ReactElement } from 'react';

import { useId } from 'react';

import { TextField } from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';
import type { RequisitesFieldBinder } from './requisitesFormTypes';

import {
  ACCOUNT_MASK,
  BIK_MASK,
} from '../../config/requisitesMasks';
import {
  REQUISITES_DIGITS_GROUP_CLASS_NAME,
  REQUISITES_GROUP_HEADING_CLASS_NAME,
} from './requisitesStyles';

export interface RequisitesBankSectionProps {
  bind: RequisitesFieldBinder;
  t: RequisitesTranslate;
}

export const RequisitesBankSection = ({ bind, t }: RequisitesBankSectionProps): ReactElement => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={REQUISITES_DIGITS_GROUP_CLASS_NAME}
      data-testid="requisites-bank"
    >
      <h3 className={REQUISITES_GROUP_HEADING_CLASS_NAME} id={headingId}>
        {t('requisites.bank.title')}
      </h3>
      <TextField autoComplete="off" label={t('requisites.bank.bik')} {...bind('bank.bik', { mask: BIK_MASK })} />
      <TextField autoComplete="off" label={t('requisites.bank.bankName')} {...bind('bank.bankName')} />
      <TextField
        autoComplete="off"
        label={t('requisites.bank.settlementAccount')}
        {...bind('bank.settlementAccount', { mask: ACCOUNT_MASK })}
      />
      <TextField
        autoComplete="off"
        label={t('requisites.bank.correspondentAccount')}
        {...bind('bank.correspondentAccount', { mask: ACCOUNT_MASK })}
      />
    </section>
  );
};
