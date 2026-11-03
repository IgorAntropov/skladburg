import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { EditorTextsGate } from '../EditorTextsGate';
import { SalesTermsCardSkeleton } from '../skeleton/SalesTermsCardSkeleton';
import { SalesTermsFormContent } from './SalesTermsFormContent';

export interface SalesTermsFormProps {
  onClose: () => void;
  terms: SalesTerms;
}

export const SalesTermsForm = ({ onClose, terms }: SalesTermsFormProps): ReactElement => (
  <EditorTextsGate skeleton={<SalesTermsCardSkeleton />}>
    <SalesTermsFormContent onClose={onClose} terms={terms} />
  </EditorTextsGate>
);
