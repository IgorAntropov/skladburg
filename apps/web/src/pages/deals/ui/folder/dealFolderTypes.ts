import type { DealReceipt } from '@skladburg/contracts/deal/v1/deal';
import type { ReactNode } from 'react';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';

export interface DealFolderProps extends DealCommandContextValue {
  canOfferManualShipment: boolean;
  documentFocusRequest?: number | undefined;
  initialDocumentId?: string | undefined;
  isReceiptLoading: boolean;
  onFocusStatus: () => void;
  onRetryReceipt: () => void;
  party: 'customer' | 'supplier' | undefined;
  receipt: DealReceipt | undefined;
  receiptError: Error | null;
  transportCard?: ReactNode | undefined;
}
