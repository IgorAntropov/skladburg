import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  ChunkLoadNotice,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { TransportTranslate } from '../i18n/transportSection';
import type {
  FormatTransportTimeValue,
  ReadTransportCityValue,
} from '../model/transportFormatting';

import { TransportSkeleton } from './TransportData';

export interface TransportInspectorProps {
  formatTime: FormatTransportTimeValue;
  id: string;
  readCity: ReadTransportCityValue;
  t: TransportTranslate;
}

interface TransportInspectorSlotProps extends TransportInspectorProps {
  kind: 'request' | 'trip';
}

const inspectorLoader = createCachedModuleLoader(() => import('./transportInspectorEntry'));

export const TransportInspectorSlot = ({ kind, ...props }: TransportInspectorSlotProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(inspectorLoader);
  const isFilled = useDelayedVisibility(state.kind === 'idle' || state.kind === 'loading');

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={t('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={t('routing.chunkError.repeated')}
      />
    );
  }

  if (state.kind === 'loaded') {
    const Inspector = kind === 'request' ? state.module.TransportRequestInspector : state.module.TransportTripInspector;

    return <Inspector {...props} />;
  }

  return <SkeletonGroup isFilled={isFilled} label={props.t('transport.loading')}><TransportSkeleton /></SkeletonGroup>;
};
