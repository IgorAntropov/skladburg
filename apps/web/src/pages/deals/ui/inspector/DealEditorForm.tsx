import type {
  ReactElement,
  ReactNode,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  LeaveConfirm,
} from '@/shared/ui';

import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

import { useDealConflictRefresh } from '../../api/commands/useDealConflictRefresh';

interface DealEditorFormProps {
  access: CommandAccessValue;
  children: ReactNode;
  command: CommandValue;
  formTestId?: string | undefined;
  isCurrentAction: boolean;
  isDirty: boolean;
  isDisabled?: boolean | undefined;
  label: string;
  onClose: () => void;
  onRefresh: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  submitTestId?: string | undefined;
  t: DealInspectorTranslate;
  version: number;
}

export const DealEditorForm = ({
  access,
  children,
  command,
  formTestId,
  isCurrentAction,
  isDirty,
  isDisabled = false,
  label,
  onClose,
  onRefresh,
  onSubmit,
  submitTestId,
  t,
  version,
}: DealEditorFormProps): ReactElement => {
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(isDirty || command.isPending);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [reviewedVersion, setReviewedVersion] = useState(version);
  const [conflictVersion, setConflictVersion] = useState<number | undefined>(undefined);

  const handleConflict = (): void => {
    setConflictVersion(reviewedVersion);
    onRefresh();
  };
  useDealConflictRefresh(command, handleConflict);

  const isReviewNeeded = reviewedVersion !== version;
  const isConflict = conflictVersion === reviewedVersion || command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isSubmitBlocked = isDisabled || isConflict || isReviewNeeded || !isCurrentAction;
  const isReviewShown = isCurrentAction && isReviewNeeded;
  const isRefreshShown = isCurrentAction && isConflict && !isReviewNeeded;

  const handleBack = (): void => {
    requestLeave(onClose);
  };

  const handleReview = (): void => {
    command.reset();
    setConflictVersion(undefined);
    setReviewedVersion(version);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (isSubmitBlocked || access.status !== 'allowed') {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-on-panel" id={titleId} ref={titleRef} tabIndex={-1}>{label}</h3>
      <Button aria-disabled={command.isPending} className="self-start" onClick={handleBack} variant="secondary">
        {t('dealInspector.back')}
      </Button>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="deal-editor-leave-confirm"
          leaveLabel={t('dealInspector.leave')}
          message={t('dealInspector.leaveMessage')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('dealInspector.stay')}
        />
      )}
      {!isCurrentAction && <p role="status">{t('dealInspector.versionOutdated')}</p>}
      {isReviewShown && (
        <div className="flex flex-col items-start gap-2">
          <p role="status">{t('dealInspector.versionChanged')}</p>
          <Button onClick={handleReview} variant="secondary">{t('dealInspector.versionReview')}</Button>
        </div>
      )}
      {isRefreshShown && (
        <Button className="self-start" onClick={onRefresh} variant="secondary">{t('dealInspector.refresh')}</Button>
      )}
      <form
        aria-labelledby={titleId}
        className="flex min-w-0 flex-col gap-3"
        data-testid={formTestId}
        noValidate
        onSubmit={handleSubmit}
      >
        {children}
        <ActionButton access={access} command={command} data-testid={submitTestId} isDisabled={isSubmitBlocked} type="submit">
          {label}
        </ActionButton>
      </form>
    </section>
  );
};
