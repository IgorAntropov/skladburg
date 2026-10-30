import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type { ReactElement } from 'react';

import {
  useCallback,
  useRef,
  useState,
} from 'react';

import { useAnnounce } from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';
import type { RequisitesEditorStateValue } from '../../lib/applySavedRequisites';
import type { RequisitesSavedSourceValue } from '../../lib/applySavedRequisites';
import type { SignatoryEditorPhaseValue } from '../../model/signatoryEditorPhase';

import { useRequisitesQuery } from '../../api/useRequisitesQuery';
import { applySavedRequisites } from '../../lib/applySavedRequisites';
import { RequisitesForm } from './RequisitesForm';
import { SignatoriesSection } from './signatories/SignatoriesSection';

export interface RequisitesEditorProps {
  onUnsavedChange: (hasUnsaved: boolean) => void;
  requisites: OrganizationRequisites;
  t: RequisitesTranslate;
}

export const RequisitesEditor = ({ onUnsavedChange, requisites, t }: RequisitesEditorProps): ReactElement => {
  const { refetch } = useRequisitesQuery();
  const announce = useAnnounce();
  const containerRef = useRef<HTMLDivElement>(null);
  const isFormDirtyRef = useRef(false);
  const signatoryPhaseRef = useRef<SignatoryEditorPhaseValue>('closed');

  const [state, setState] = useState<RequisitesEditorStateValue>(() => ({
    epoch: 0,
    formVersion: requisites.version,
    requisites,
    signatoriesVersion: requisites.version,
  }));
  const [isReloading, setIsReloading] = useState(false);

  const applySaved = (saved: OrganizationRequisites, source: RequisitesSavedSourceValue): void => {
    const options = {
      isFormDirty: isFormDirtyRef.current,
      isSignatoryEditing: signatoryPhaseRef.current !== 'closed',
      source,
    };

    setState(current => applySavedRequisites(current, saved, options));
  };

  const reportUnsaved = useCallback((): void => {
    onUnsavedChange(isFormDirtyRef.current || signatoryPhaseRef.current === 'dirty');
  }, [onUnsavedChange]);

  const handleFormDirtyChange = useCallback((isDirty: boolean): void => {
    isFormDirtyRef.current = isDirty;
    reportUnsaved();
  }, [reportUnsaved]);

  const handleSignatoryPhaseChange = useCallback((phase: SignatoryEditorPhaseValue): void => {
    signatoryPhaseRef.current = phase;
    reportUnsaved();
  }, [reportUnsaved]);

  const handleFormSaved = (saved: OrganizationRequisites): void => {
    console.log('> RequisitesEditor -> handleFormSaved:', { version: String(saved.version) });
    applySaved(saved, 'form');
  };

  const handleSignatoriesSaved = (saved: OrganizationRequisites): void => {
    console.log('> RequisitesEditor -> handleSignatoriesSaved:', { version: String(saved.version) });
    applySaved(saved, 'signatories');
  };

  const handleReload = (): void => {
    console.log('> RequisitesEditor -> handleReload:', { version: String(state.requisites.version) });
    setIsReloading(true);
    void refetch().then((result) => {
      setIsReloading(false);

      if (!result.isSuccess) {
        return;
      }

      applySaved(result.data, 'reload');
      announce(t('requisites.reloaded'));
      containerRef.current?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-4" ref={containerRef} tabIndex={-1}>
      <RequisitesForm
        formVersion={state.formVersion}
        isReloading={isReloading}
        key={`form-${String(state.epoch)}`}
        onDirtyChange={handleFormDirtyChange}
        onReload={handleReload}
        onSaved={handleFormSaved}
        requisites={state.requisites}
        t={t}
      />
      <SignatoriesSection
        isReloading={isReloading}
        key={`signatories-${String(state.epoch)}`}
        onPhaseChange={handleSignatoryPhaseChange}
        onReload={handleReload}
        onSaved={handleSignatoriesSaved}
        signatories={state.requisites.signatories}
        signatoriesVersion={state.signatoriesVersion}
        t={t}
      />
    </div>
  );
};
