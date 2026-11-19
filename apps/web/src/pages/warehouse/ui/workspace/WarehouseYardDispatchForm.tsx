import type { YardDispatchOptions } from '@skladburg/contracts/wms/v1/receiving';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  LeaveConfirm,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { YardDispatchResultValue } from '../../api/useYardDispatchForm';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { YardDispatchActionValue } from '../../model/yardDispatchDraft';

import { useYardDispatchForm } from '../../api/useYardDispatchForm';
import { readYardDispatchDraft } from '../../model/yardDispatchDraft';

export interface YardDispatchIntentValue {
  action: YardDispatchActionValue;
  initialDockId: string;
  taskId: string;
  taskLabel: string;
  taskVersion: number;
}

export interface YardDispatchSnapshotValue {
  options: undefined | YardDispatchOptions;
  version: number | undefined;
}

interface WarehouseYardDispatchFormProps {
  canManage: boolean;
  dockCodes: ReadonlyMap<string, string>;
  intent: YardDispatchIntentValue;
  onClose: () => void;
  onEditingChange: (isEditing: boolean) => void;
  onRefresh: (taskId: string) => Promise<YardDispatchSnapshotValue>;
  onSuccess: (result: YardDispatchResultValue) => void;
  snapshot: YardDispatchSnapshotValue;
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const REFUSAL_TEXT = {
  ALREADY_ASSIGNED: 'warehouseWork.yardDispatchAlreadyAssigned',
  ALREADY_PROMOTED: 'warehouseWork.yardDispatchAlreadyPromoted',
  DOCK_BUSY: 'warehouseWork.yardDispatchDockBusy',
  DOCK_NOT_FOUND: 'warehouseWork.yardDispatchDockRemoved',
  INCOMPATIBLE_DOCK: 'warehouseWork.yardDispatchDockIncompatible',
  PASS_REJECTED: 'warehouseWork.yardPassRejected',
  RESERVATION_PROTECTED: 'warehouseWork.yardDispatchReservationProtected',
  SLOT_NOT_STARTED: 'warehouseWork.yardDispatchSlotNotStarted',
  VISIT_NOT_WAITING: 'warehouseWork.yardDispatchNotWaiting',
  WAITING_DOCUMENTS: 'warehouseWork.yardWaitingDocuments',
} as const;

const hasKey = <T extends object>(record: T, key: PropertyKey): key is keyof T => Object.hasOwn(record, key);

export const WarehouseYardDispatchForm = ({
  canManage, dockCodes, intent, onClose, onEditingChange, onRefresh, onSuccess, snapshot, t, warehouseId,
}: WarehouseYardDispatchFormProps): ReactElement => {
  const [expectedVersion, setExpectedVersion] = useState(intent.taskVersion);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReviewUnavailable, setIsReviewUnavailable] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isAssign = intent.action === 'assign';
  const form = useYardDispatchForm({ ...intent, expectedVersion, onSuccess, t, warehouseId });
  const access = useCommandAccess(form.command.method, { kind: 'warehouse', warehouseId });
  const isPending = form.command.isPending;
  const error = form.command.apiError;
  const isStateError = error?.code === ErrorCode.VERSION_CONFLICT || error?.code === ErrorCode.YARD_DISPATCH_BLOCKED;
  const isWriteDenied = error?.code === ErrorCode.PERMISSION_DENIED || error?.code === ErrorCode.SESSION_REQUIRED
    || error?.code === ErrorCode.MEMBERSHIP_REQUIRED;
  const selectedDockId = form.watchField('unloadingPointId');
  const status = readYardDispatchDraft(intent.action, expectedVersion, snapshot.version, selectedDockId, snapshot.options);
  const hasConflict = status.hasConflict || isStateError;
  const canWrite = canManage && access.status === 'allowed' && !isWriteDenied;
  const isEditing = form.isDirty || isPending || hasConflict || isReviewing;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const isSubmitBlocked = hasConflict || isPending || isLeavePending || isReviewing || !status.canSubmit;
  const isDockReadOnly = isPending || hasConflict || isReviewing || !canWrite;
  const title = t(isAssign ? 'warehouseWork.yardDispatchAssign' : 'warehouseWork.yardDispatchPromote');
  const refused = error?.params.case === 'yardDispatchBlocked' ? error.params.value.reason : undefined;
  const refusalText = refused !== undefined && hasKey(REFUSAL_TEXT, refused) ? t(REFUSAL_TEXT[refused]) : undefined;
  const assignable = snapshot.options?.assignableUnloadingPointIds ?? [];
  const hasCurrentSelection = selectedDockId === '' || assignable.includes(selectedDockId);
  const isNoDockAvailable = isAssign && assignable.length === 0 && !hasConflict;
  const canShowCommandError = !isStateError && !isWriteDenied;
  const initialFocus = isAssign && intent.initialDockId === '' ? 'select' : 'input';

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (!canWrite || isSubmitBlocked) {
      event.preventDefault();
      return;
    }
    form.handleSubmit(event);
  };

  const handleClose = (): void => {
    requestLeave(onClose);
  };

  const review = async (): Promise<void> => {
    setIsReviewing(true);
    setIsReviewUnavailable(false);
    try {
      const latest = await onRefresh(intent.taskId);
      if (latest.version === undefined || latest.options === undefined) {
        setIsReviewUnavailable(true);
        return;
      }
      setExpectedVersion(latest.version);
      form.setFieldValue('unloadingPointId', '');
      form.command.reset();
      const control = isAssign ? 'select' : 'input';
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(control)?.focus());
    }
    finally {
      setIsReviewing(false);
    }
  };

  const handleReview = (): void => {
    void review();
  };

  useLayoutEffect(() => {
    onEditingChange(isEditing);
    return () => {
      onEditingChange(false);
    };
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(initialFocus)?.focus();
  }, [initialFocus]);

  return (
    <form
      className="flex min-w-0 flex-col gap-3 rounded-control border border-line p-3"
      data-testid="yard-dispatch-form"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-on-panel-muted wrap-anywhere">{intent.taskLabel}</p>
      </div>
      {isAssign && (
        <div data-testid="yard-dispatch-dock">
          <SelectField
            {...form.getFieldProps('unloadingPointId')}
            isReadOnly={isDockReadOnly}
            label={t('warehouseWork.yardDispatchDock')}
          >
            <option value="">{t('warehouseWork.yardDispatchSelectDock')}</option>
            {!hasCurrentSelection && <option value={selectedDockId}>{dockCodes.get(selectedDockId) ?? selectedDockId.slice(-8)}</option>}
            {assignable.map(id => <option key={id} value={id}>{dockCodes.get(id) ?? id.slice(-8)}</option>)}
          </SelectField>
        </div>
      )}
      <div data-testid="yard-dispatch-reason">
        <TextField
          {...form.getFieldProps('reason')}
          isReadOnly={isPending || !canWrite}
          label={t('warehouseWork.yardDispatchReason')}
        />
      </div>
      {(hasConflict || isReviewUnavailable) && (
        <div className="flex flex-col items-start gap-2" data-testid="yard-dispatch-conflict">
          <p className="text-sm" role="status">
            {isReviewUnavailable
              ? t('warehouseWork.yardDispatchReviewUnavailable')
              : refusalText ?? t('warehouseWork.yardDispatchChanged')}
          </p>
          <Button data-testid="yard-dispatch-review" disabled={isReviewing || isLeavePending} onClick={handleReview} variant="secondary">
            {t('warehouseWork.yardDispatchReview')}
          </Button>
        </div>
      )}
      {isNoDockAvailable && <p className="text-sm text-on-panel-muted">{t('warehouseWork.yardDispatchNoDockNow')}</p>}
      {!canWrite && <p className="text-sm text-on-panel-muted" role="status">{t('warehouseWork.yardDispatchReadOnly')}</p>}
      <div className="flex flex-wrap gap-2">
        {canWrite && (
          <ActionButton
            access={access}
            command={form.command}
            data-testid="yard-dispatch-submit"
            errorPlacement="external"
            isDisabled={isSubmitBlocked}
            type="submit"
          >
            {t('warehouseWork.yardDispatchConfirm')}
          </ActionButton>
        )}
        <Button data-testid="yard-dispatch-cancel" disabled={isPending || isLeavePending} onClick={handleClose} variant="secondary">
          {t('warehouseWork.cancel')}
        </Button>
      </div>
      {canShowCommandError && <CommandErrorNotice command={form.command} />}
      {isLeavePending && (
        <LeaveConfirm
          data-testid="yard-dispatch-discard"
          leaveLabel={t('warehouseWork.leave')}
          message={t('warehouseWork.yardDispatchLeave')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('warehouseWork.stay')}
        />
      )}
    </form>
  );
};
