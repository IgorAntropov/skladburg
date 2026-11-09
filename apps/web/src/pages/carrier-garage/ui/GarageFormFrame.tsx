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
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  LeaveConfirm,
} from '@/shared/ui';

import { garageSection } from '../i18n/garageSection';

interface GarageFormFrameProps {
  children: ReactNode;
  command: CommandValue;
  isDirty: boolean;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  testId: string;
  title: string;
}

export const GarageFormFrame = ({
  children,
  command,
  isDirty,
  onClose,
  onSubmit,
  testId,
  title,
}: GarageFormFrameProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { t } = useCatalogSection(garageSection);
  const access = useCommandAccess(command.method, { kind: 'organization' });
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(isDirty || command.isPending);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const isConflict = hasConflict || command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isSubmitBlocked = isConflict || isLeavePending || access.status !== 'allowed' || command.isPending;

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

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (isSubmitBlocked) {
      event.preventDefault();

      return;
    }

    onSubmit(event);
  };

  const handleEscape = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || command.isPending) {
      return;
    }

    event.preventDefault();
    if (isLeavePending) {
      handleStay();

      return;
    }

    handleClose();
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  if (t === undefined) {
    return <p role="status">{mainT('routing.section.loading')}</p>;
  }

  return (
    <form
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4"
      data-testid={testId}
      noValidate
      onKeyDown={handleEscape}
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-semibold text-on-panel" id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="garage-leave-confirm"
          leaveLabel={t('garage.leave.confirm')}
          message={t('garage.leave.message')}
          onLeave={confirmLeave}
          onStay={handleStay}
          stayLabel={t('garage.leave.stay')}
        />
      )}
      <fieldset className="flex min-w-0 flex-col gap-4" disabled={access.status !== 'allowed' || command.isPending}>
        {children}
      </fieldset>
      {isConflict && <p className="text-on-panel-muted" role="status">{t('garage.conflict')}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <ActionButton
          access={access}
          command={command}
          data-testid="garage-save"
          isDisabled={isSubmitBlocked}
          type="submit"
        >
          {t('garage.actions.save')}
        </ActionButton>
        <Button
          aria-disabled={command.isPending}
          data-testid="garage-cancel"
          onClick={handleClose}
          ref={cancelRef}
          variant="secondary"
        >
          {t(isConflict ? 'garage.actions.close' : 'garage.actions.cancel')}
        </Button>
      </div>
    </form>
  );
};
