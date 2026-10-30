import { createDigitMask } from '@/shared/lib/mask';

export const BIK_MASK = createDigitMask('#########', '000000000');

export const ACCOUNT_MASK = createDigitMask('##### ### # #### #######', '00000 000 0 0000 0000000');
