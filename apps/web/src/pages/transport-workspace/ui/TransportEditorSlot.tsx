import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { TransportEditorProps } from './forms/transportEditorTypes';

import { TransportSkeleton } from './TransportData';

interface TransportEditorSlotValue {
  editor: ReactElement;
  open: () => void;
}

const formLoader = createCachedModuleLoader(() => import('./forms/transportEditorEntry'));

export const useTransportEditorSlot = (props: TransportEditorProps): TransportEditorSlotValue => {
  const { t } = props;
  const { t: mainT } = useI18n();
  const { load, state } = useChunkLoader(formLoader);
  const isFilled = useDelayedVisibility(state.kind === 'loading');

  if (state.kind === 'loaded') {
    return { editor: <state.module.TransportEditor {...props} />, open: load };
  }

  if (state.kind === 'failed') {
    return {
      editor: (
        <div className="flex flex-col items-start gap-2">
          <ChunkLoadNotice
            message={mainT('routing.chunkError.message')}
            onRetry={load}
            recovery={state.recovery}
            repeatedMessage={mainT('routing.chunkError.repeated')}
          />
          <Button onClick={props.onClose} variant="secondary">{t('transport.form.cancel')}</Button>
        </div>
      ),
      open: load,
    };
  }

  return {
    editor: (
      <div className="flex flex-col gap-2">
        <SkeletonGroup isFilled={isFilled} label={t('transport.loading')}><TransportSkeleton /></SkeletonGroup>
        <Button className="self-start" onClick={props.onClose} variant="secondary">{t('transport.form.cancel')}</Button>
      </div>
    ),
    open: load,
  };
};
