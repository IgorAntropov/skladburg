import type {
  KeyboardEvent,
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

import type { CommandValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  LeaveConfirm,
} from '@/shared/ui';

import type { TransportTranslate } from '../../i18n/transportSection';

import { useRefreshOnVersionConflict } from '../../api/useRefreshOnVersionConflict';

interface TransportFormFrameProps {
  children: ReactNode;
  command: CommandValue;
  formTestId: string;
  isCurrentAction: boolean;
  isDirty: boolean;
  isDisabled?: boolean | undefined;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submitTestId: string;
  t: TransportTranslate;
  title: string;
  version?: number | undefined;
}

export const TransportFormFrame = ({
  children,
  command,
  formTestId,
  isCurrentAction,
  isDirty,
  isDisabled = false,
  onClose,
  onRefresh,
  onSubmit,
  submitLabel,
  submitTestId,
  t,
  title,
  version,
}: TransportFormFrameProps): ReactElement => {
  const access = useCommandAccess(command.method, { kind: 'organization' });
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(isDirty || command.isPending);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [reviewedVersion, setReviewedVersion] = useState(version);
  const [hasConflict, setHasConflict] = useState(false);

  const isConflict = hasConflict || command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isReviewNeeded = reviewedVersion !== version;
  const isSubmitBlocked = isDisabled || isConflict || isReviewNeeded || !isCurrentAction || isLeavePending || command.isPending;

  if (isConflict && !hasConflict) {
    setHasConflict(true);
  }

  const handleClose = (): void => {
    requestLeave(onClose);
  };

  const handleStay = (): void => {
    cancelLeave();
    cancelRef.current?.focus();
  };

  const handleEscape = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || command.isPending) {
      return;
    }

    event.preventDefault();
    if (isLeavePending) {
      handleStay();
    }
    else {
      handleClose();
    }
  };

  const handleReview = (): void => {
    command.reset();
    setHasConflict(false);
    setReviewedVersion(version);
  };

  const handleRefresh = (): void => {
    void onRefresh();
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

  useRefreshOnVersionConflict(command, onRefresh);

  return (
    <form
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-control border border-line p-3"
      data-testid={formTestId}
      noValidate
      onKeyDown={handleEscape}
      onSubmit={handleSubmit}
    >
      <h3 className="font-semibold text-on-panel" id={titleId} ref={titleRef} tabIndex={-1}>{title}</h3>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="transport-form-leave-confirm"
          leaveLabel={t('transport.form.leave')}
          message={t('transport.form.leaveMessage')}
          onLeave={confirmLeave}
          onStay={handleStay}
          stayLabel={t('transport.form.stay')}
        />
      )}
      {!isCurrentAction && <p role="status">{t('transport.form.outdated')}</p>}
      {isCurrentAction && (isConflict || isReviewNeeded) && (
        <div className="flex flex-col items-start gap-2">
          <p role="status">{t('transport.form.conflict')}</p>
          {isReviewNeeded
            ? <Button onClick={handleReview} variant="secondary">{t('transport.form.review')}</Button>
            : <Button onClick={handleRefresh} variant="secondary">{t('transport.form.refresh')}</Button>}
        </div>
      )}
      <fieldset className="flex min-w-0 flex-col gap-3" disabled={access.status !== 'allowed' || command.isPending || !isCurrentAction}>
        {children}
      </fieldset>
      <div className="flex flex-wrap items-start gap-2">
        <ActionButton
          access={access}
          command={command}
          data-testid={submitTestId}
          errorPlacement="external"
          isDisabled={isSubmitBlocked}
          type="submit"
        >
          {submitLabel}
        </ActionButton>
        <Button aria-disabled={command.isPending} onClick={handleClose} ref={cancelRef} variant="secondary">
          {t('transport.form.cancel')}
        </Button>
      </div>
      <CommandErrorNotice command={command} />
    </form>
  );
};
