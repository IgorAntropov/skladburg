import type { ReactElement } from 'react';

import { useState } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
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
import { OwnAwareInspectorBody } from './inspector/OwnAwareInspectorBody';
import { ListingInspectorSkeleton } from './ListingInspectorSkeleton';

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

  const [bodyTitle, setBodyTitle] = useState<string | undefined>(undefined);

  const title = bodyTitle ?? t('object.type.listing');
  const showcaseBody = gate.isOpen
    ? <OpenListingInspectorBody gate={gate} listingId={focus.id} onTitleChange={setBodyTitle} />
    : <ListingInspectorBody state={toGateInspectorState(gate)} />;

  return (
    <ObjectInspector focus={focus} onClose={onClose} title={title}>
      <div data-testid="listing-inspector">
        <CatalogTextsGate skeleton={<ListingInspectorSkeleton />}>
          {gate.isOwnAvailable
            ? <OwnAwareInspectorBody listingId={focus.id} onTitleChange={setBodyTitle}>{showcaseBody}</OwnAwareInspectorBody>
            : showcaseBody}
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
