import type {
  ReactElement,
  RefCallback,
} from 'react';

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import {
  AccessButton,
  useFocusHandoff,
} from '@/shared/ui';

import type { CreateWarehouseLauncherValue } from '../model/useCreateWarehouseLauncher';

import { CREATE_WAREHOUSE_FOCUS_KEY } from '../model/createWarehouseFocusKey';
import { CreateWarehouseRecoveryNotice } from './CreateWarehouseRecoveryNotice';

export interface CreateWarehouseButtonProps {
  launcher: CreateWarehouseLauncherValue;
}

export const CreateWarehouseButton = ({ launcher }: CreateWarehouseButtonProps): ReactElement => {
  const { t } = useI18n();
  const { cancelFocus, ref: handoffRef } = useFocusHandoff<HTMLButtonElement>(CREATE_WAREHOUSE_FOCUS_KEY);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(launcher.isOpen);

  const {
    access,
    isLoading,
    isOpen,
    loadRecovery,
    open,
    panelId,
    warmUp,
  } = launcher;

  const isLoadFailed = loadRecovery !== undefined;
  const loadErrorMessage = loadRecovery === 'reload'
    ? t('warehouse.create.loadError.repeated')
    : t('warehouse.create.loadError.message');

  const setButtonRef = useCallback<RefCallback<HTMLButtonElement>>((element) => {
    buttonRef.current = element;
    handoffRef(element);
  }, [handoffRef]);

  const handleClick = (): void => {
    console.log('> CreateWarehouseButton -> handleClick:', { isOpen });
    open();
  };

  const handleRetry = (): void => {
    console.log('> CreateWarehouseButton -> handleRetry:', {});
    open();
  };

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      buttonRef.current?.focus();
      cancelFocus();
    }
    wasOpenRef.current = isOpen;
  }, [cancelFocus, isOpen]);

  return (
    <div className="flex flex-col items-start gap-2">
      <AccessButton
        access={access}
        aria-controls={isOpen ? panelId : undefined}
        aria-expanded={isOpen}
        data-testid="create-warehouse-button"
        onClick={handleClick}
        onFocus={warmUp}
        onPointerEnter={warmUp}
        pending={isLoading}
        pendingLabel={t('warehouse.create.opening')}
        ref={setButtonRef}
        variant="secondary"
      >
        {t('warehouse.create.open')}
      </AccessButton>
      {isLoadFailed && (
        <CreateWarehouseRecoveryNotice
          message={loadErrorMessage}
          onRetry={handleRetry}
          recovery={loadRecovery}
        />
      )}
    </div>
  );
};
