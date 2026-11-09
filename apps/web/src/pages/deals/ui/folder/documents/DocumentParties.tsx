import type {
  DocumentContent,
  DocumentParty,
} from '@skladburg/contracts/document/v1/document';
import type { ReactElement } from 'react';

import {
  SignatoryBasis,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';

import { useI18n } from '@/shared/i18n';

import type { DealDocumentTranslate } from './documentSection';

import { DocumentFact } from './DocumentFact';

const VAT_KEYS = {
  [VatMode.GENERAL]: 'dealDocument.vatGeneral',
  [VatMode.SIMPLIFIED_WITH_VAT]: 'dealDocument.vatSimplified',
  [VatMode.UNSPECIFIED]: 'dealDocument.notSpecified',
  [VatMode.WITHOUT_VAT]: 'dealDocument.vatWithout',
} as const;

const SIGNATORY_BASIS_KEYS = {
  [SignatoryBasis.CHARTER]: 'dealDocument.charter',
  [SignatoryBasis.POWER_OF_ATTORNEY]: 'dealDocument.powerOfAttorney',
  [SignatoryBasis.UNSPECIFIED]: 'dealDocument.notSpecified',
} as const;

interface DocumentPartyDetailsProps {
  label: string;
  party: DocumentParty;
  t: DealDocumentTranslate;
}

const DocumentPartyDetails = ({ label, party, t }: DocumentPartyDetailsProps): ReactElement => {
  const { formatCalendarDate } = useI18n();
  const { bank, signatory } = party;
  const powerOfAttorneyDate = signatory?.powerOfAttorneyDate;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div>
        <p className="text-sm text-on-panel-muted">{label}</p>
        <h5 className="font-semibold wrap-anywhere">{party.legalName || t('dealDocument.notSpecified')}</h5>
      </div>
      <dl className="flex flex-col gap-1 text-sm">
        <DocumentFact label={t('dealDocument.inn')} value={party.inn} />
        <DocumentFact label={t('dealDocument.kpp')} value={party.kpp} />
        <DocumentFact label={t('dealDocument.ogrn')} value={party.ogrn} />
        <DocumentFact label={t('dealDocument.address')} value={party.legalAddress} />
        <DocumentFact label={t('dealDocument.vatMode')} value={t(VAT_KEYS[party.vatMode])} />
        <DocumentFact label={t('dealDocument.bank')} value={bank?.bankName} />
        <DocumentFact label={t('dealDocument.bik')} value={bank?.bik} />
        <DocumentFact label={t('dealDocument.settlementAccount')} value={bank?.settlementAccount} />
        <DocumentFact label={t('dealDocument.correspondentAccount')} value={bank?.correspondentAccount} />
      </dl>
      {signatory !== undefined && (
        <dl className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
          <DocumentFact label={t('dealDocument.signatory')} value={signatory.fullName} />
          <DocumentFact label={t('dealDocument.signatoryPosition')} value={signatory.position} />
          <DocumentFact
            label={t('dealDocument.signatoryBasis')}
            value={t(SIGNATORY_BASIS_KEYS[signatory.basis])}
          />
          <DocumentFact label={t('dealDocument.powerOfAttorneyNumber')} value={signatory.powerOfAttorneyNumber} />
          <DocumentFact
            label={t('dealDocument.powerOfAttorneyDate')}
            value={powerOfAttorneyDate === undefined ? undefined : formatCalendarDate(powerOfAttorneyDate)}
          />
        </dl>
      )}
    </div>
  );
};

interface DocumentPartiesProps {
  content: DocumentContent;
  t: DealDocumentTranslate;
}

export const DocumentParties = ({ content, t }: DocumentPartiesProps): null | ReactElement => {
  const { customer, supplier } = content;

  if (customer === undefined && supplier === undefined) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-3">
      <h4 className="font-semibold">{t('dealDocument.parties')}</h4>
      {supplier !== undefined && <DocumentPartyDetails label={t('dealDocument.supplier')} party={supplier} t={t} />}
      {customer !== undefined && <DocumentPartyDetails label={t('dealDocument.customer')} party={customer} t={t} />}
    </section>
  );
};
