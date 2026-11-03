import type { ReactElement } from 'react';

import { ArrowLeft } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { useNavigationGuard } from '@/shared/routing';
import {
  Button,
  LeaveConfirm,
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
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const {
    cancelLeave,
    confirmLeave,
    isLeavePending,
    requestLeave,
  } = useNavigationGuard(hasUnsaved);

  const isTextsReady = t !== undefined;

  const handleBackClick = (): void => {
    console.log('> RequisitesPanel -> handleBackClick:', { hasUnsaved });
    requestLeave(onClose);
  };

  const handleStayClick = (): void => {
    console.log('> RequisitesPanel -> handleStayClick:', {});
    cancelLeave();
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
      {isLeavePending && (
        <LeaveConfirm
          data-testid="requisites-leave-confirm"
          leaveLabel={t('requisites.leave.confirm')}
          message={t('requisites.leave.message')}
          onLeave={confirmLeave}
          onStay={handleStayClick}
          stayLabel={t('requisites.leave.stay')}
        />
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
            onUnsavedChange={setHasUnsaved}
            requisites={loadedRequisites}
            t={t}
          />
        )}
      </WidgetStates>
    </div>
  );
};
