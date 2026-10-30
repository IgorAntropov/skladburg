import type { ReactElement } from 'react';

import { ArrowLeft } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  WidgetStates,
} from '@/shared/ui';

import { useRequisitesQuery } from '../../api/useRequisitesQuery';
import { requisitesSection } from '../../i18n/requisitesSection';
import { RequisitesEditor } from './RequisitesEditor';
import { RequisitesFieldsSkeleton } from './RequisitesFieldsSkeleton';
import { RequisitesPanelFallback } from './RequisitesPanelFallback';

export interface RequisitesPanelProps {
  onClose: () => void;
}

export const RequisitesPanel = ({ onClose }: RequisitesPanelProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry: retryTexts, status, t } = useCatalogSection(requisitesSection);
  const {
    data: requisites,
    error,
    isFetching,
    refetch,
  } = useRequisitesQuery();
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const leaveConfirmRef = useRef<HTMLDivElement>(null);
  const hasUnsavedRef = useRef(false);
  const [isLeaveConfirmShown, setIsLeaveConfirmShown] = useState(false);

  const isTextsReady = t !== undefined;

  const handleUnsavedChange = useCallback((hasUnsaved: boolean): void => {
    hasUnsavedRef.current = hasUnsaved;
  }, []);

  const handleBackClick = (): void => {
    console.log('> RequisitesPanel -> handleBackClick:', { hasUnsaved: hasUnsavedRef.current });

    if (hasUnsavedRef.current) {
      setIsLeaveConfirmShown(true);

      return;
    }

    onClose();
  };

  const handleLeaveClick = (): void => {
    console.log('> RequisitesPanel -> handleLeaveClick:', {});
    onClose();
  };

  const handleStayClick = (): void => {
    console.log('> RequisitesPanel -> handleStayClick:', {});
    setIsLeaveConfirmShown(false);
    backButtonRef.current?.focus();
  };

  const handleRetry = (): void => {
    console.log('> RequisitesPanel -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  useEffect(() => {
    if (isTextsReady) {
      backButtonRef.current?.focus();
    }
  }, [isTextsReady]);

  useEffect(() => {
    if (isLeaveConfirmShown) {
      leaveConfirmRef.current?.focus();
    }
  }, [isLeaveConfirmShown]);

  if (t === undefined) {
    return <RequisitesPanelFallback onRetry={retryTexts} status={status} />;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="requisites-panel">
      <Button
        className="self-start"
        data-testid="requisites-panel-back"
        onClick={handleBackClick}
        ref={backButtonRef}
        variant="secondary"
      >
        <ArrowLeft aria-hidden className="size-4 shrink-0" />
        {t('requisites.back')}
      </Button>
      {isLeaveConfirmShown && (
        <div
          className="flex flex-col items-start gap-3 rounded-control border border-line-strong p-3"
          data-testid="requisites-leave-confirm"
          ref={leaveConfirmRef}
          role="group"
          tabIndex={-1}
        >
          <p className="text-base leading-6 text-on-panel">{t('requisites.leave.message')}</p>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="requisites-leave-confirm-leave" onClick={handleLeaveClick} variant="primary">
              {t('requisites.leave.confirm')}
            </Button>
            <Button data-testid="requisites-leave-confirm-stay" onClick={handleStayClick} variant="secondary">
              {t('requisites.leave.stay')}
            </Button>
          </div>
        </div>
      )}
      <h2 className="text-base leading-6 font-semibold text-balance text-on-panel">{t('requisites.title')}</h2>
      <WidgetStates
        data={requisites}
        error={error}
        isRetrying={isFetching}
        loadingLabel={mainT('organization.card.requisitesLoading')}
        onRetry={handleRetry}
        skeleton={<RequisitesFieldsSkeleton />}
      >
        {loadedRequisites => (
          <RequisitesEditor
            key={loadedRequisites.organizationId}
            onUnsavedChange={handleUnsavedChange}
            requisites={loadedRequisites}
            t={t}
          />
        )}
      </WidgetStates>
    </div>
  );
};
