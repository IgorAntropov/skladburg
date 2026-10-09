import type {
  KeyboardEvent,
  MouseEvent,
  ReactElement,
} from 'react';

import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  ErrorNotice,
  useAnnounce,
} from '@/shared/ui';

import { useResetDemoMutation } from '../api/useResetDemoMutation';

const GROUP_CLASS_NAME = 'flex gap-x-4 gap-y-3';

interface ResetDemoConfirmProps {
  isStacked?: boolean | undefined;
  onClose: () => void;
}

export const ResetDemoConfirm = ({ isStacked = false, onClose }: ResetDemoConfirmProps): ReactElement => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const promptId = useId();
  const hintId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const {
    error,
    isError,
    isPending,
    mutate,
    submittedAt,
  } = useResetDemoMutation();

  const prompt = t('demo.reset.confirm.prompt');
  const doneMessage = t('demo.reset.done');

  const handleAcceptClick = (event: MouseEvent<HTMLButtonElement>): void => {
    console.log('> ResetDemoConfirm -> handleAcceptClick:', { isPending });
    event.currentTarget.focus();
    mutate(undefined, {
      onSuccess: () => {
        announce(doneMessage);
        onClose();
      },
    });
  };

  const handleCancelClick = (): void => {
    console.log('> ResetDemoConfirm -> handleCancelClick:', { isPending });
    onClose();
  };

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') {
      return;
    }
    console.log('> ResetDemoConfirm -> handleGroupKeyDown:', { isPending });
    if (isPending) {
      return;
    }
    event.stopPropagation();
    onClose();
  };

  useEffect(() => {
    cancelButtonRef.current?.focus();
    announce(prompt);
  }, [announce, prompt]);

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        aria-describedby={hintId}
        aria-labelledby={promptId}
        className={cn(GROUP_CLASS_NAME, isStacked ? 'flex-col items-start' : 'flex-wrap items-center')}
        onKeyDown={handleGroupKeyDown}
        role="group"
      >
        <div className="flex flex-col">
          <p className="text-base font-medium whitespace-nowrap" id={promptId}>{prompt}</p>
          <p className="text-sm text-on-panel-muted" id={hintId}>{t('demo.reset.confirm.hint')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={isPending}
            onClick={handleCancelClick}
            ref={cancelButtonRef}
            variant="secondary"
          >
            {t('demo.reset.confirm.cancel')}
          </Button>
          <Button
            className="min-w-28"
            onClick={handleAcceptClick}
            pending={isPending}
            pendingLabel={t('demo.reset.pending')}
          >
            {t('demo.reset.confirm.accept')}
          </Button>
        </div>
      </div>
      {isError && <ErrorNotice announceKey={submittedAt} error={error} />}
    </div>
  );
};
