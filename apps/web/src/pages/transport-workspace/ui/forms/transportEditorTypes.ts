import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';

import type { TransportTranslate } from '../../i18n/transportSection';

export type TransportEditorProps = (
  { kind: 'assignment'; trip: Trip }
  | { kind: 'offer'; requestId: string }
) & {
  isCurrentAction: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSaved: () => void;
  t: TransportTranslate;
};
