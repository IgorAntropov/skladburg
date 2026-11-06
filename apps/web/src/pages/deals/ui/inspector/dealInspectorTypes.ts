import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

export interface DealEditorProps extends DealCommandContextValue {
  isCurrentAction: boolean;
  onClose: () => void;
  t: DealInspectorTranslate;
}

export type DealEditorValue = 'cancel' | 'confirm' | 'counter' | 'delivery' | 'draft' | 'reject' | 'rejectOffer';
