import type { ReactElement } from 'react';

import type { ListingEditorProps } from './listingEditorTypes';

import { EditorTextsGate } from '../EditorTextsGate';
import { OwnListingInspectorSkeleton } from '../skeleton/OwnListingInspectorSkeleton';
import { ListingEditorContent } from './ListingEditorContent';

export const ListingEditor = ({ onClose, pair }: ListingEditorProps): ReactElement => (
  <EditorTextsGate skeleton={<OwnListingInspectorSkeleton />}>
    <ListingEditorContent onClose={onClose} pair={pair} />
  </EditorTextsGate>
);
