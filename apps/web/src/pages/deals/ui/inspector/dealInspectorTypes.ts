import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

export interface ActiveDealEditorProps extends DealEditorProps {
  action: DealEditorValue;
}

export interface DealEditorProps extends DealCommandContextValue {
  isCurrentAction: boolean;
  onClose: () => void;
  onPublished: () => void;
  t: DealInspectorTranslate;
}

export type DealEditorValue = 'cancel' | 'confirm' | 'counter' | 'delivery' | 'draft' | 'publishTransport' | 'reject' | 'rejectOffer';
