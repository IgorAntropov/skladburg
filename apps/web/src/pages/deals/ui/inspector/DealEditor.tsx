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
import { DealDraftForm } from './DealDraftForm';
import { DealReasonForm } from './DealReasonForm';

const loadCounterForm = createCachedModuleLoader(() => import('./counterFormEntry'));

interface ActiveDealEditorProps extends DealEditorProps {
  action: DealEditorValue;
}

const CounterFormLoader = (props: DealEditorProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { onClose, t } = props;
  const { load, state } = useChunkLoader(loadCounterForm);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    const { CounterDealForm } = state.module;

    return <CounterDealForm {...props} />;
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
      return <CounterFormLoader {...props} />;
    case 'delivery':
      return <DealDeliveryForm {...props} />;
    case 'draft':
      return <DealDraftForm {...props} />;
    case 'reject':
      return <DealReasonForm {...props} kind="rejectDeal" />;
    case 'rejectOffer':
      return <DealReasonForm {...props} kind="rejectCounterOffer" />;
  }
};
