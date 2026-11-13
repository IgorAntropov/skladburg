import type { ReactElement } from 'react';

import {
  useEffect,
  useState,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import { ChunkLoadNotice } from '@/shared/ui';
import { ObjectInspector } from '@/widgets/object-inspector';

import type { ListingInspectorGateValue } from '../api/useListingInspectorState';

import {
  toGateInspectorState,
  useListingInspectorGate,
  useOpenListingInspectorState,
} from '../api/useListingInspectorState';
import { useReportedTitle } from '../model/useReportedTitle';
import { CatalogTextsGate } from './CatalogTextsGate';
import { ListingInspectorBody } from './inspector/ListingInspectorBody';
import { ListingInspectorSkeleton } from './ListingInspectorSkeleton';

const loadOwnInspector = createCachedModuleLoader(() => import('./inspector/OwnAwareInspectorBody'));

interface FocusedListingInspectorProps {
  focus: ObjectRefValue;
  onClose: () => void;
}

interface ListingInspectorProps {
  focus: ObjectRefValue | undefined;
  onClose: () => void;
}

interface OpenListingInspectorBodyProps {
  gate: ListingInspectorGateValue;
  listingId: string;
  onTitleChange: (title: string | undefined) => void;
}

const OpenListingInspectorBody = ({
  gate,
  listingId,
  onTitleChange,
}: OpenListingInspectorBodyProps): ReactElement => {
  const state = useOpenListingInspectorState(listingId, gate);

  useReportedTitle(state.listing?.productName, onTitleChange);

  return <ListingInspectorBody state={state} />;
};

const FocusedListingInspector = ({ focus, onClose }: FocusedListingInspectorProps): ReactElement => {
  const { t } = useI18n();
  const gate = useListingInspectorGate();
  const { load, state } = useChunkLoader(loadOwnInspector);

  const [bodyTitle, setBodyTitle] = useState<string | undefined>(undefined);

  const title = bodyTitle ?? t('object.type.listing');
  const showcaseBody = gate.isOpen
    ? <OpenListingInspectorBody gate={gate} listingId={focus.id} onTitleChange={setBodyTitle} />
    : <ListingInspectorBody state={toGateInspectorState(gate)} />;

  useEffect(() => {
    if (gate.isOwnAvailable) {
      load();
    }
  }, [gate.isOwnAvailable, load]);

  let body = showcaseBody;
  if (gate.isOwnAvailable) {
    if (state.kind === 'loaded') {
      body = (
        <state.module.OwnAwareInspectorBody listingId={focus.id} onTitleChange={setBodyTitle}>
          {showcaseBody}
        </state.module.OwnAwareInspectorBody>
      );
    }
    else if (state.kind === 'failed') {
      body = (
        <ChunkLoadNotice
          message={t('routing.chunkError.message')}
          onRetry={load}
          recovery={state.recovery}
          repeatedMessage={t('routing.chunkError.repeated')}
        />
      );
    }
    else {
      body = <ListingInspectorSkeleton />;
    }
  }

  return (
    <ObjectInspector focus={focus} onClose={onClose} title={title}>
      <div data-testid="listing-inspector">
        <CatalogTextsGate skeleton={<ListingInspectorSkeleton />}>
          {body}
        </CatalogTextsGate>
      </div>
    </ObjectInspector>
  );
};

export const ListingInspector = ({ focus, onClose }: ListingInspectorProps): ReactElement => {
  if (focus?.type !== 'listing') {
    return <ObjectInspector focus={focus} onClose={onClose} />;
  }

  return <FocusedListingInspector focus={focus} onClose={onClose} />;
};
