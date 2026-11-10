import type { ReactNode } from 'react';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';

export interface DealFolderProps extends DealCommandContextValue {
  documentFocusRequest?: number | undefined;
  initialDocumentId?: string | undefined;
  onFocusStatus: () => void;
  party: 'customer' | 'supplier' | undefined;
  transportCard?: ReactNode | undefined;
}
