import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { ObjectInspector } from '@/widgets/object-inspector';

import type {
  ListingInspectorGateValue,
  ListingInspectorStateValue,
} from '../api/useListingInspectorState';

import {
  toGateInspectorState,
  useListingInspectorGate,
  useOpenListingInspectorState,
} from '../api/useListingInspectorState';
import { CatalogTextsGate } from './CatalogTextsGate';
import { ListingInspectorBody } from './inspector/ListingInspectorBody';
import { ListingInspectorSkeleton } from './ListingInspectorSkeleton';

interface FocusedListingInspectorProps {
  focus: ObjectRefValue;
  onClose: () => void;
}

interface ListingInspectorProps {
  focus: ObjectRefValue | undefined;
  onClose: () => void;
}

interface ListingInspectorShellProps extends FocusedListingInspectorProps {
  state: ListingInspectorStateValue;
}

interface OpenListingInspectorProps extends FocusedListingInspectorProps {
  gate: ListingInspectorGateValue;
}

const ListingInspectorShell = ({ focus, onClose, state }: ListingInspectorShellProps): ReactElement => {
  const { t } = useI18n();

  const title = state.listing?.productName ?? t('object.type.listing');

  return (
    <ObjectInspector focus={focus} onClose={onClose} title={title}>
      <div data-testid="listing-inspector">
        <CatalogTextsGate skeleton={<ListingInspectorSkeleton />}>
          <ListingInspectorBody state={state} />
        </CatalogTextsGate>
      </div>
    </ObjectInspector>
  );
};

const OpenListingInspector = ({ focus, gate, onClose }: OpenListingInspectorProps): ReactElement => {
  const state = useOpenListingInspectorState(focus.id, gate);

  return <ListingInspectorShell focus={focus} onClose={onClose} state={state} />;
};

const FocusedListingInspector = ({ focus, onClose }: FocusedListingInspectorProps): ReactElement => {
  const gate = useListingInspectorGate();

  if (gate.isOpen) {
    return <OpenListingInspector focus={focus} gate={gate} onClose={onClose} />;
  }

  return <ListingInspectorShell focus={focus} onClose={onClose} state={toGateInspectorState(gate)} />;
};

export const ListingInspector = ({ focus, onClose }: ListingInspectorProps): ReactElement => {
  if (focus?.type !== 'listing') {
    return <ObjectInspector focus={focus} onClose={onClose} />;
  }

  return <FocusedListingInspector focus={focus} onClose={onClose} />;
};
