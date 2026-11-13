import type { ReactElement } from 'react';

import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  CircleCheck,
  CircleHelp,
  Clock3,
  FilePenLine,
  FileX,
} from 'lucide-react';

import type { DealDocumentTranslate } from './documentSection';

import { DOCUMENT_STATUS_KEYS } from './documentLabels';

const STATUS_ICONS = {
  [DocumentStatus.ANNULLED]: FileX,
  [DocumentStatus.APPROVED]: Clock3,
  [DocumentStatus.DRAFT]: FilePenLine,
  [DocumentStatus.SIGNED]: CircleCheck,
  [DocumentStatus.UNSPECIFIED]: CircleHelp,
};

interface DealDocumentStatusProps {
  status: DocumentStatus;
  t: DealDocumentTranslate;
  type: DocumentType;
}

export const DealDocumentStatus = ({ status, t, type }: DealDocumentStatusProps): ReactElement => {
  const isWarehouseDocument = type >= DocumentType.UPD;
  const isIssued = isWarehouseDocument && status === DocumentStatus.APPROVED;
  const isWarehouseSigned = isWarehouseDocument && status === DocumentStatus.SIGNED;
  const Icon = isIssued ? CircleCheck : STATUS_ICONS[status];
  const statusKey = isIssued
    ? 'dealDocument.status.issued'
    : isWarehouseSigned ? 'dealDocument.status.warehouseSigned' : DOCUMENT_STATUS_KEYS[status];

  return (
    <span className="inline-flex items-start gap-1.5 text-sm text-on-panel-muted">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      {t(statusKey)}
    </span>
  );
};
