import type { ReactElement } from 'react';

import { useEffect } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

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
import { ObjectInspector } from '@/widgets/object-inspector';

import { ListingInspectorSkeleton } from './ListingInspectorSkeleton';

interface ListingInspectorSlotProps {
  focus: ObjectRefValue | undefined;
  onClose: () => void;
}

const loadListingInspector = createCachedModuleLoader(() => import('./ListingInspector'));

const FocusedInspectorSlot = ({ focus, onClose }: ListingInspectorSlotProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadListingInspector);
  const isLoading = state.kind === 'idle' || state.kind === 'loading';
  const isFilled = useDelayedVisibility(isLoading);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return <state.module.ListingInspector focus={focus} onClose={onClose} />;
  }

  return (
    <ObjectInspector focus={focus} onClose={onClose} title={t('object.type.listing')}>
      {state.kind === 'failed'
        ? (
            <ChunkLoadNotice
              message={t('routing.chunkError.message')}
              onRetry={load}
              recovery={state.recovery}
              repeatedMessage={t('routing.chunkError.repeated')}
            />
          )
        : (
            <SkeletonGroup isFilled={isFilled} label={t('routing.section.loading')}>
              <ListingInspectorSkeleton />
            </SkeletonGroup>
          )}
    </ObjectInspector>
  );
};

export const ListingInspectorSlot = ({ focus, onClose }: ListingInspectorSlotProps): ReactElement => (
  focus?.type === 'listing'
    ? <FocusedInspectorSlot focus={focus} onClose={onClose} />
    : <ObjectInspector focus={focus} onClose={onClose} />
);
