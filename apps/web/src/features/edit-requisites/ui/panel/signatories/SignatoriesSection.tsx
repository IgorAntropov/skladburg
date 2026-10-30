import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type { ReactElement } from 'react';

import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { AccessButton } from '@/shared/ui';

import type { RequisitesTranslate } from '../../../i18n/requisitesSection';
import type { SignatoryEditorPhaseValue } from '../../../model/signatoryEditorPhase';

import { useIsRequisitesCommandPending } from '../../../api/useIsRequisitesCommandPending';
import {
  REQUISITES_GROUP_CLASS_NAME,
  REQUISITES_GROUP_HEADING_CLASS_NAME,
  REQUISITES_NOTE_CLASS_NAME,
} from '../requisitesStyles';
import { SignatoryEditor } from './SignatoryEditor';
import { SignatoryItem } from './SignatoryItem';

const SIGNATORIES_LIMIT = 10;

type EditorTargetValue
  = | { id: string; kind: 'edit' }
    | { kind: 'new' };

const resolvePhase = (isOpen: boolean, isDirty: boolean): SignatoryEditorPhaseValue => {
  if (!isOpen) {
    return 'closed';
  }

  return isDirty ? 'dirty' : 'open';
};

export interface SignatoriesSectionProps {
  isReloading: boolean;
  onPhaseChange: (phase: SignatoryEditorPhaseValue) => void;
  onReload: () => void;
  onSaved: (requisites: OrganizationRequisites) => void;
  signatories: OrganizationRequisites['signatories'];
  signatoriesVersion: bigint;
  t: RequisitesTranslate;
}

export const SignatoriesSection = ({
  isReloading,
  onPhaseChange,
  onReload,
  onSaved,
  signatories,
  signatoriesVersion,
  t,
}: SignatoriesSectionProps): ReactElement => {
  const headingId = useId();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const saveAccess = useCommandAccess(OrganizationRequisitesService.method.saveSignatory);
  const isCommandPending = useIsRequisitesCommandPending();
  const [editorTarget, setEditorTarget] = useState<EditorTargetValue | undefined>(undefined);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const focusRequestRef = useRef<string | undefined>(undefined);

  const isEditorOpen = editorTarget !== undefined;
  const isLimitReached = signatories.length >= SIGNATORIES_LIMIT;
  const isBlocked = isEditorOpen || isCommandPending;
  const isAddBlocked = isBlocked || isLimitReached;
  const phase = resolvePhase(isEditorOpen, isEditorDirty);
  const isEditorShownForNew = editorTarget?.kind === 'new';
  const reasonKey = isEditorOpen ? 'requisites.signatories.reason.editing' : 'requisites.signatories.reason.limit';
  const isReasonShown = isEditorOpen || isLimitReached;

  const handleAddClick = (): void => {
    console.log('> SignatoriesSection -> handleAddClick:', { count: signatories.length });
    setEditorTarget({ kind: 'new' });
  };

  const handleEdit = (signatoryId: string): void => {
    console.log('> SignatoriesSection -> handleEdit:', { signatoryId });
    setEditorTarget({ id: signatoryId, kind: 'edit' });
  };

  const closeEditor = (): void => {
    if (editorTarget?.kind === 'edit') {
      focusRequestRef.current = editorTarget.id;
    }
    else {
      addButtonRef.current?.focus();
    }

    setEditorTarget(undefined);
  };

  const handleEditorCancel = (): void => {
    console.log('> SignatoriesSection -> handleEditorCancel:', { target: editorTarget?.kind });
    closeEditor();
  };

  const handleEditorSaved = (saved: OrganizationRequisites): void => {
    console.log('> SignatoriesSection -> handleEditorSaved:', { version: String(saved.version) });
    closeEditor();
    onSaved(saved);
  };

  const handleItemChanged = (saved: OrganizationRequisites, signatoryId: string): void => {
    console.log('> SignatoriesSection -> handleItemChanged:', { signatoryId, version: String(saved.version) });

    if (!saved.signatories.some(signatory => signatory.id === signatoryId)) {
      addButtonRef.current?.focus();
    }

    onSaved(saved);
  };

  const consumeFocusRequest = useCallback((signatoryId: string): boolean => {
    const isRequested = focusRequestRef.current === signatoryId;

    if (isRequested) {
      focusRequestRef.current = undefined;
    }

    return isRequested;
  }, []);

  useEffect(() => {
    onPhaseChange(phase);

    return (): void => {
      onPhaseChange('closed');
    };
  }, [onPhaseChange, phase]);

  return (
    <section aria-labelledby={headingId} className={REQUISITES_GROUP_CLASS_NAME} data-testid="requisites-signatories">
      <h3 className={REQUISITES_GROUP_HEADING_CLASS_NAME} id={headingId}>
        {t('requisites.signatories.title')}
      </h3>
      {signatories.length === 0 && <p className={REQUISITES_NOTE_CLASS_NAME}>{t('requisites.signatories.empty')}</p>}
      {signatories.length > 0 && (
        <ul className="flex flex-col gap-3">
          {signatories.map(signatory => (
            editorTarget?.kind === 'edit' && editorTarget.id === signatory.id
              ? (
                  <li key={signatory.id}>
                    <SignatoryEditor
                      isDefault={signatory.isDefault}
                      isReloading={isReloading}
                      onCancel={handleEditorCancel}
                      onDirtyChange={setIsEditorDirty}
                      onReload={onReload}
                      onSaved={handleEditorSaved}
                      signatoriesVersion={signatoriesVersion}
                      signatory={signatory}
                      t={t}
                    />
                  </li>
                )
              : (
                  <SignatoryItem
                    consumeFocusRequest={consumeFocusRequest}
                    isBlocked={isBlocked}
                    isReloading={isReloading}
                    key={signatory.id}
                    onChanged={handleItemChanged}
                    onEdit={handleEdit}
                    onReload={onReload}
                    signatoriesVersion={signatoriesVersion}
                    signatory={signatory}
                    t={t}
                  />
                )
          ))}
        </ul>
      )}
      {isEditorShownForNew && (
        <SignatoryEditor
          isDefault={signatories.length === 0}
          isReloading={isReloading}
          onCancel={handleEditorCancel}
          onDirtyChange={setIsEditorDirty}
          onReload={onReload}
          onSaved={handleEditorSaved}
          signatoriesVersion={signatoriesVersion}
          signatory={undefined}
          t={t}
        />
      )}
      {isReasonShown && <p className={REQUISITES_NOTE_CLASS_NAME}>{t(reasonKey)}</p>}
      <AccessButton
        access={saveAccess}
        className="self-start"
        data-testid="requisites-signatory-add"
        isDisabled={isAddBlocked}
        onClick={handleAddClick}
        ref={addButtonRef}
        variant="secondary"
      >
        {t('requisites.signatories.add')}
      </AccessButton>
    </section>
  );
};
