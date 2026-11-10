import type {
  ComponentType,
  ReactElement,
} from 'react';

import { useEffect } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

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
  ActiveDealEditorProps,
  DealEditorValue,
} from './dealInspectorTypes';

const loadCounterForm = createCachedModuleLoader(() =>
  import('./counterFormEntry').then(({ CounterDealForm }) => ({ Form: CounterDealForm })));
const loadDraftForm = createCachedModuleLoader(() => import('./DealDraftForm').then(({ DealDraftForm }) => ({ Form: DealDraftForm })));
const loadPublishForm = createCachedModuleLoader(() =>
  import('../transport/PublishTransportForm').then(({ PublishTransportForm }) => ({ Form: PublishTransportForm })));
const loadStandardForm = createCachedModuleLoader(() =>
  import('./DealStandardForms').then(({ DealStandardForms }) => ({ Form: DealStandardForms })));

interface DealFormModuleValue {
  Form: ComponentType<ActiveDealEditorProps>;
}

const FORM_LOADERS = {
  cancel: loadStandardForm,
  confirm: loadStandardForm,
  counter: loadCounterForm,
  delivery: loadStandardForm,
  draft: loadDraftForm,
  publishTransport: loadPublishForm,
  reject: loadStandardForm,
  rejectOffer: loadStandardForm,
} satisfies Record<DealEditorValue, CachedModuleLoader<DealFormModuleValue>>;

export const DealEditor = (props: ActiveDealEditorProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { action, onClose, t } = props;
  const { load, state } = useChunkLoader<DealFormModuleValue>(FORM_LOADERS[action]);

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
