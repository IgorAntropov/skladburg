import type { ReactElement } from 'react';

import {
  useId,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import { useIsDemoResetAvailable } from '../api/useIsDemoResetAvailable';
import { useIsDemoResetPending } from '../api/useIsDemoResetPending';
import { ResetDemoConfirm } from './ResetDemoConfirm';

const POPOVER_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 w-max',
  'rounded-panel border border-line bg-panel-solid p-4 shadow-panel',
].join(' ');

export const ResetDemoButton = (): null | ReactElement => {
  const { t } = useI18n();
  const isDemoResetAvailable = useIsDemoResetAvailable();
  const isResetPending = useIsDemoResetPending();
  const confirmId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleResetClick = (): void => {
    console.log('> ResetDemoButton -> handleResetClick:', { isConfirming, isResetPending });
    if (isResetPending) {
      return;
    }
    setIsConfirming(current => !current);
  };

  const handleConfirmClose = (): void => {
    console.log('> ResetDemoButton -> handleConfirmClose:', { isConfirming });
    setIsConfirming(false);
    buttonRef.current?.focus();
  };

  if (!isDemoResetAvailable) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        aria-controls={isConfirming ? confirmId : undefined}
        aria-expanded={isConfirming}
        onClick={handleResetClick}
        ref={buttonRef}
        variant="secondary"
      >
        {t('demo.reset.label')}
      </Button>
      {isConfirming && (
        <div className={POPOVER_CLASS_NAME} id={confirmId}>
          <ResetDemoConfirm isStacked onClose={handleConfirmClose} />
        </div>
      )}
    </div>
  );
};
