import { WAREHOUSE_YARD_MORNING_WAREHOUSE_ID } from '@/shared/api';
import { formatAddressPath } from '@/shared/routing';

export const MORNING_YARD_PATH = formatAddressPath({
  kind: 'object',
  object: { id: WAREHOUSE_YARD_MORNING_WAREHOUSE_ID, type: 'warehouse' },
});
