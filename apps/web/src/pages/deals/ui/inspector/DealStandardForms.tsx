import type { ReactElement } from 'react';

import type { ActiveDealEditorProps } from './dealInspectorTypes';

import { ConfirmDealForm } from './ConfirmDealForm';
import { DealDeliveryForm } from './DealDeliveryForm';
import { DealReasonForm } from './DealReasonForm';

export const DealStandardForms = ({ action, ...props }: ActiveDealEditorProps): null | ReactElement => {
  switch (action) {
    case 'cancel':
      return <DealReasonForm {...props} kind="cancelDeal" />;
    case 'confirm':
      return <ConfirmDealForm {...props} />;
    case 'delivery':
      return <DealDeliveryForm {...props} />;
    case 'reject':
      return <DealReasonForm {...props} kind="rejectDeal" />;
    case 'rejectOffer':
      return <DealReasonForm {...props} kind="rejectCounterOffer" />;
    default:
      return null;
  }
};
