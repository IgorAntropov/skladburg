import type {
  KeyboardEvent,
  ReactElement,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from 'react';

import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

interface WarehouseObjectDialogProps {
  children: ReactNode;
  closeTestId: string;
  fallbackFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  testId: string;
  title: string;
}

export const WarehouseObjectDialog = ({
  children, closeTestId, fallbackFocus, onClose, testId, title,
}: WarehouseObjectDialogProps): ReactElement => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    event.stopPropagation();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const fallback = fallbackFocus.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (document.activeElement === document.body) {
        const target = trigger instanceof HTMLElement && trigger !== document.body && trigger.isConnected ? trigger : fallback;
        target?.focus({ preventScroll: true });
      }
    };
  }, [fallbackFocus]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[min(94vw,28rem)] overflow-auto rounded-panel border border-line bg-panel-solid p-4 text-on-panel"
      data-testid={testId}
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
        <Button data-testid={closeTestId} onClick={onClose} variant="secondary">{t('hud.inspector.close')}</Button>
      </header>
      {children}
    </dialog>
  );
};
