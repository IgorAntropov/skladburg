import type { DealReceipt } from '@skladburg/contracts/deal/v1/deal';

import type { DealFolderProps } from '../dealFolderTypes';

export interface DealWarehouseReceiptProps extends Pick<DealFolderProps, 'deal' | 'onFocusStatus' | 'onRefresh' | 'onUpdated' | 'party'> {
  isOutbound: boolean;
  receipt: DealReceipt | undefined;
}
