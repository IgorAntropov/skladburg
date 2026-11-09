import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import type {
  DealEditorProps,
  DealEditorValue,
} from './dealInspectorTypes';

import { ConfirmDealForm } from './ConfirmDealForm';
import { DealDeliveryForm } from './DealDeliveryForm';
import { DealReasonForm } from './DealReasonForm';

const loadCounterForm = createCachedModuleLoader(() =>
  import('./counterFormEntry').then(({ CounterDealForm }) => ({ Form: CounterDealForm })));
const loadDraftForm = createCachedModuleLoader(() => import('./DealDraftForm').then(({ DealDraftForm }) => ({ Form: DealDraftForm })));

interface ActiveDealEditorProps extends DealEditorProps {
  action: DealEditorValue;
}

interface DealFormLoaderProps extends DealEditorProps {
  loadForm: typeof loadCounterForm;
}

const DealFormLoader = ({ loadForm, ...props }: DealFormLoaderProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { onClose, t } = props;
  const { load, state } = useChunkLoader(loadForm);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    const { Form } = state.module;

    return <Form {...props} />;
  }

  if (state.kind === 'failed') {
    return (
      <div className="flex flex-col items-start gap-2">
        <ChunkLoadNotice
          message={baseText('routing.chunkError.message')}
          onRetry={load}
          recovery={state.recovery}
          repeatedMessage={baseText('routing.chunkError.repeated')}
        />
        <Button onClick={onClose} variant="secondary">{t('dealInspector.back')}</Button>
      </div>
    );
  }

  return (
    <SkeletonGroup isFilled label={t('dealInspector.loading')}>
      <Skeleton shape="block" />
    </SkeletonGroup>
  );
};

export const DealEditor = ({ action, ...props }: ActiveDealEditorProps): ReactElement => {
  switch (action) {
    case 'cancel':
      return <DealReasonForm {...props} kind="cancelDeal" />;
    case 'confirm':
      return <ConfirmDealForm {...props} />;
    case 'counter':
      return <DealFormLoader {...props} loadForm={loadCounterForm} />;
    case 'delivery':
      return <DealDeliveryForm {...props} />;
    case 'draft':
      return <DealFormLoader {...props} loadForm={loadDraftForm} />;
    case 'reject':
      return <DealReasonForm {...props} kind="rejectDeal" />;
    case 'rejectOffer':
      return <DealReasonForm {...props} kind="rejectCounterOffer" />;
  }
};
