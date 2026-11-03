import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { useId } from 'react';

import { PublicationBadge } from '@/entities/listing';
import { ActionButton } from '@/shared/ui';

import { usePublishListing } from '../../api/usePublishListing';
import { useEditorTexts } from '../../model/useEditorTexts';
import { EditorReloadButton } from '../editor-shared/EditorReloadButton';
import {
  EDITOR_ACTIONS_CLASS_NAME,
  EDITOR_GROUP_CLASS_NAME,
  EDITOR_GROUP_HEADING_CLASS_NAME,
  EDITOR_NOTE_CLASS_NAME,
  EDITOR_WIDE_BUTTON_CLASS_NAME,
} from '../editor-shared/editorStyles';
import { RuleErrorNotice } from '../editor-shared/RuleErrorNotice';

interface ListingPublicationProps {
  hasUnsavedChanges: boolean;
  isReloading: boolean;
  listing: Listing;
  onPublished: (saved: Listing) => void;
  onReload: () => void;
}

export const ListingPublication = ({
  hasUnsavedChanges,
  isReloading,
  listing,
  onPublished,
  onReload,
}: ListingPublicationProps): ReactElement => {
  const t = useEditorTexts();
  const titleId = useId();
  const { access, command } = usePublishListing({ listing, onPublished });

  const { isPublished } = listing;
  const isVersionConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const stateKey = isPublished ? 'catalogEditor.publication.published' : 'catalogEditor.publication.draft';
  const actionKey = isPublished ? 'catalogEditor.publication.unpublish' : 'catalogEditor.publication.publish';

  return (
    <section aria-labelledby={titleId} className={EDITOR_GROUP_CLASS_NAME} data-testid="listing-publication">
      <h4 className={EDITOR_GROUP_HEADING_CLASS_NAME} id={titleId}>{t('catalogEditor.publication.title')}</h4>
      <div className={EDITOR_ACTIONS_CLASS_NAME}>
        <PublicationBadge isPublished={isPublished} />
        <p className={EDITOR_NOTE_CLASS_NAME}>{t(stateKey)}</p>
        {!isPublished && <p className={EDITOR_NOTE_CLASS_NAME}>{t('catalogEditor.publication.draftHint')}</p>}
        {hasUnsavedChanges && <p className={EDITOR_NOTE_CLASS_NAME}>{t('catalogEditor.publication.dirty')}</p>}
        <ActionButton
          access={access}
          className={EDITOR_WIDE_BUTTON_CLASS_NAME}
          command={command}
          data-testid="listing-publish"
          errorPlacement="external"
          variant="secondary"
        >
          {t(actionKey)}
        </ActionButton>
        <RuleErrorNotice command={command} />
        {isVersionConflict && (
          <EditorReloadButton isReloading={isReloading} onReload={onReload} testId="listing-publish-reload" />
        )}
      </div>
    </section>
  );
};
