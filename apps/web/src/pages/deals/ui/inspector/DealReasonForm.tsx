import type { ReactElement } from 'react';

import { DealService } from '@skladburg/contracts/deal/v1/deal';

import { TextField } from '@/shared/ui';

import type { DealReasonCommand } from '../../api/commands/useDealReasonForm';
import type { DealEditorProps } from './dealInspectorTypes';

import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import { useDealReasonForm } from '../../api/commands/useDealReasonForm';
import { DealEditorForm } from './DealEditorForm';

const REASON_LABELS = {
  cancelDeal: 'dealInspector.cancel',
  rejectCounterOffer: 'dealInspector.rejectOffer',
  rejectDeal: 'dealInspector.reject',
} as const;

interface DealReasonFormProps extends DealEditorProps {
  kind: DealReasonCommand;
}

export const DealReasonForm = ({ deal, isCurrentAction, kind, onClose, onRefresh, onUpdated, t }: DealReasonFormProps): ReactElement => {
  const access = useDealCommandAccess(DealService.method[kind]);
  const form = useDealReasonForm({ deal, kind, onRefresh, onUpdated });

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      label={t(REASON_LABELS[kind])}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitTestId={kind === 'cancelDeal' ? 'deal-cancel-submit' : undefined}
      t={t}
      version={deal.version}
    >
      <TextField {...form.getFieldProps('reason')} label={t('dealInspector.reason')} />
    </DealEditorForm>
  );
};
