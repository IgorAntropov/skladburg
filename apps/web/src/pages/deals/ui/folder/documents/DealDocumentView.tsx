import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { Document } from '@skladburg/contracts/document/v1/document';
import type { ReactElement } from 'react';

import { DocumentStatus } from '@skladburg/contracts/document/v1/document';
import { useRef } from 'react';

import type { PrintPageValue } from '@/features/print-labels';

import { canSignDealDocument } from '@/entities/document';
import { PrintLabels } from '@/features/print-labels';
import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { DealDocumentTranslate } from './documentSection';

import { DealDocumentStatus } from './DealDocumentStatus';
import { formatDocumentNumberAndDate } from './documentLabels';
import { DocumentParties } from './DocumentParties';
import { DocumentSignatures } from './DocumentSignatures';
import { DocumentTerms } from './DocumentTerms';
import { SignDealDocumentButton } from './SignDealDocumentButton';

interface DealDocumentViewProps {
  deal: Deal;
  document: Document;
  heading: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRefreshDocument: () => Promise<boolean>;
  onRequestHeadingFocus: () => void;
  t: DealDocumentTranslate;
}

export const DealDocumentView = ({
  deal,
  document,
  heading,
  isRefreshing,
  onRefresh,
  onRefreshDocument,
  onRequestHeadingFocus,
  t,
}: DealDocumentViewProps): ReactElement => {
  const { organizationId } = useActingContext();
  const { formatCalendarDate } = useI18n();
  const sheetRef = useRef<HTMLDivElement>(null);
  const { content, date, displayNumber, signatures, status } = document;
  const canSign = canSignDealDocument(deal, document, organizationId);
  const hasSignatures = status !== DocumentStatus.DRAFT && signatures.length > 0;

  const getPrintPages = (): PrintPageValue[] => {
    const contentText = sheetRef.current?.innerText ?? '';
    const details = contentText.split('\n').filter(line => line.trim() !== '');
    return [{ address: { kind: 'object', object: { id: deal.id, type: 'deal' } }, details, heading, kind: 'document' }];
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-panel-solid p-3" ref={sheetRef}>
        <div className="flex flex-col gap-1 border-b border-line pb-3">
          <p className="text-sm wrap-anywhere">{formatDocumentNumberAndDate(displayNumber, date, formatCalendarDate, t)}</p>
          <DealDocumentStatus status={status} t={t} type={document.type} />
        </div>
        {content !== undefined && (
          <>
            <DocumentTerms deal={deal} t={t} terms={content.terms} />
            <DocumentParties content={content} t={t} />
          </>
        )}
        {hasSignatures && <DocumentSignatures signatures={signatures} t={t} />}
      </div>
      {content !== undefined && displayNumber !== '' && <PrintLabels getPages={getPrintPages} label={t('dealDocument.print')} />}
      {canSign && (
        <SignDealDocumentButton
          dealId={deal.id}
          document={document}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onRefreshDocument={onRefreshDocument}
          onRequestHeadingFocus={onRequestHeadingFocus}
          t={t}
        />
      )}
    </>
  );
};
