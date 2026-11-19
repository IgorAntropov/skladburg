import type {
  YardQueuePolicy,
  YardQueueWeights,
} from '@skladburg/contracts/wms/v1/yard_queue_policy';
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

import {
  useCommandAccess,
  useSessionQuery,
} from '@/entities/session';
import { isReadAccessDenied } from '@/shared/api';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  LeaveConfirm,
  Skeleton,
  TextField,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import {
  useYardQueuePolicy,
  useYardQueuePolicyForm,
} from '../../api/useYardQueuePolicy';

interface WarehouseYardPolicyContentProps extends WarehouseYardPolicyEditorProps {
  current: YardQueuePolicy;
  isMember: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

interface WarehouseYardPolicyDraftProps extends WarehouseYardPolicyEditorProps {
  baseline: YardQueuePolicy;
  current: YardQueuePolicy;
  isMember: boolean;
  isRefreshing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onRefresh: () => void;
  onReplace: (policy: YardQueuePolicy) => void;
  onSave: (policy: YardQueuePolicy) => void;
  weights: YardQueueWeights;
}

interface WarehouseYardPolicyEditorProps {
  onClose: () => void;
  t: WarehouseWorkTranslate;
}

const WEIGHT_FIELDS = [
  { hint: 'warehouseWork.yardWeightExplicitHint', label: 'warehouseWork.yardWeightExplicit', name: 'explicitUrgencyWeight',
    testId: 'yard-queue-weight-explicit-urgency' },
  { hint: 'warehouseWork.yardWeightCargoHint', label: 'warehouseWork.yardWeightCargo', name: 'cargoUrgencyWeight',
    testId: 'yard-queue-weight-cargo-urgency' },
  { hint: 'warehouseWork.yardWeightWindowHint', label: 'warehouseWork.yardWeightWindow', name: 'deliveryWindowWeight',
    testId: 'yard-queue-weight-delivery-window' },
  { hint: 'warehouseWork.yardWeightWaitingHint', label: 'warehouseWork.yardWeightWaiting', name: 'waitingTimeWeight',
    testId: 'yard-queue-weight-waiting-time' },
  { hint: 'warehouseWork.yardWeightResourcesHint', label: 'warehouseWork.yardWeightResources', name: 'resourceAvailabilityWeight',
    testId: 'yard-queue-weight-resource-availability' },
] as const;

const WarehouseYardPolicyDraft = ({
  baseline, current, isMember, isRefreshing, onClose, onEditingChange, onRefresh, onReplace, onSave, t, weights,
}: WarehouseYardPolicyDraftProps): ReactElement => {
  const form = useYardQueuePolicyForm(baseline.version, weights, onSave);
  const access = useCommandAccess(form.command.method, { kind: 'organization' });
  const [hasServerConflict, setHasServerConflict] = useState(false);
  const [hasWriteDenial, setHasWriteDenial] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const isPending = form.command.isPending;
  const errorCode = form.command.apiError?.code;
  const isServerConflict = errorCode === ErrorCode.VERSION_CONFLICT;
  const isWriteDenied = hasWriteDenial || errorCode === ErrorCode.PERMISSION_DENIED || errorCode === ErrorCode.MEMBERSHIP_REQUIRED
    || errorCode === ErrorCode.SESSION_REQUIRED;
  const isEditing = form.isDirty || isPending || hasServerConflict || isServerConflict;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const canSave = isMember && access.status === 'allowed' && !isWriteDenied;
  const latestWeights = current.version > baseline.version ? current.weights : undefined;
  const hasConflict = latestWeights !== undefined || hasServerConflict || isServerConflict;
  const isSubmitBlocked = hasConflict || isLeavePending || isPending || !form.isDirty;

  if (isServerConflict && !hasServerConflict) {
    setHasServerConflict(true);
  }
  if (isWriteDenied && !hasWriteDenial) {
    setHasWriteDenial(true);
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (!canSave || isSubmitBlocked) {
      event.preventDefault();
      return;
    }
    form.handleSubmit(event);
  };

  const handleClose = (): void => {
    setIsReplacing(false);
    requestLeave(onClose);
  };

  const handleCompare = (): void => {
    setIsComparing(true);
    onRefresh();
  };

  const handleReplace = (): void => {
    setIsReplacing(true);
    requestLeave(() => {
      onReplace(current);
    });
  };

  useLayoutEffect(() => {
    onEditingChange(isEditing);
  }, [isEditing, onEditingChange]);

  return (
    <form className="flex min-w-0 flex-col gap-3" noValidate onSubmit={handleSubmit}>
      <p className="text-sm text-on-panel-muted">{t('warehouseWork.yardPolicyRange')}</p>
      {!canSave && (
        <p className="text-sm text-on-panel-muted" role="status">
          {t(isWriteDenied ? 'warehouseWork.yardPolicyWriteDenied' : 'warehouseWork.yardPolicyReadOnly')}
        </p>
      )}
      <div className="grid gap-x-4 gap-y-2 @md:grid-cols-2">
        {WEIGHT_FIELDS.map(({ hint, label, name, testId }) => {
          const field = form.getFieldProps(name);
          const fieldClassName = name === 'resourceAvailabilityWeight' ? 'min-w-0 @md:col-span-2' : 'min-w-0';
          return (
            <div className={fieldClassName} data-testid={testId} key={name}>
              <TextField
                {...field}
                hint={t(hint)}
                inputMode="numeric"
                isReadOnly={!canSave || field.isReadOnly}
                label={t(label)}
                messageLines={2}
              />
            </div>
          );
        })}
      </div>
      {hasConflict && (
        <div
          className="flex flex-col items-start gap-2 rounded-control border border-line-strong p-3"
          data-testid="yard-queue-policy-conflict"
        >
          <p role="status">{t('warehouseWork.yardPolicyConflict')}</p>
          <Button
            data-testid="yard-queue-policy-compare"
            disabled={isRefreshing || isLeavePending}
            onClick={handleCompare}
            variant="secondary"
          >
            {t('warehouseWork.yardPolicyCompare')}
          </Button>
          {isComparing && latestWeights === undefined && (
            <p role="status">
              {t(isRefreshing ? 'warehouseWork.yardPolicyCompareWaiting' : 'warehouseWork.yardPolicyCompareUnavailable')}
            </p>
          )}
          {isComparing && latestWeights !== undefined && (
            <>
              <div data-testid="yard-queue-policy-current">
                <p className="font-medium">{t('warehouseWork.yardPolicyCurrent')}</p>
                <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
                  {WEIGHT_FIELDS.map(({ label, name }) => (
                    <div className="contents" key={name}>
                      <dt>{t(label)}</dt>
                      <dd className="text-right tabular-nums">{latestWeights[name]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <Button data-testid="yard-queue-policy-reload" disabled={isLeavePending} onClick={handleReplace} variant="secondary">
                {t('warehouseWork.yardPolicyReplace')}
              </Button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {canSave && (
          <ActionButton
            access={access}
            command={form.command}
            data-testid="yard-queue-policy-save"
            errorPlacement="external"
            isDisabled={isSubmitBlocked}
            type="submit"
          >
            {t('warehouseWork.yardPolicySave')}
          </ActionButton>
        )}
        <Button data-testid="yard-queue-policy-close" disabled={isPending || isLeavePending} onClick={handleClose} variant="secondary">
          {t(isEditing ? 'warehouseWork.cancel' : 'warehouseWork.yardPolicyClose')}
        </Button>
      </div>
      {!hasConflict && !isWriteDenied && <CommandErrorNotice command={form.command} />}
      {isLeavePending && (
        <LeaveConfirm
          data-testid="yard-queue-policy-discard"
          leaveLabel={t(isReplacing ? 'warehouseWork.yardPolicyReplaceConfirm' : 'warehouseWork.leave')}
          message={t(isReplacing ? 'warehouseWork.yardPolicyReplaceMessage' : 'warehouseWork.yardPolicyLeave')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('warehouseWork.stay')}
        />
      )}
    </form>
  );
};

const WarehouseYardPolicyContent = ({
  current, isMember, isRefreshing, onClose, onRefresh, t,
}: WarehouseYardPolicyContentProps): null | ReactElement => {
  const [baseline, setBaseline] = useState(current);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const policy = !isEditing && current.version > baseline.version ? current : baseline;

  if (policy !== baseline) {
    setBaseline(policy);
  }

  const handleReplace = (latest: YardQueuePolicy): void => {
    setBaseline(latest.version >= current.version ? latest : current);
    setIsEditing(false);
  };

  const handleSave = (saved: YardQueuePolicy): void => {
    handleReplace(saved);
    setHasSaved(true);
  };

  if (policy.weights === undefined) {
    return null;
  }

  return (
    <>
      {hasSaved && !isEditing && <p className="text-sm" role="status">{t('warehouseWork.yardPolicySaved')}</p>}
      <WarehouseYardPolicyDraft
        baseline={policy}
        current={current}
        isMember={isMember}
        isRefreshing={isRefreshing}
        key={policy.version.toString()}
        onClose={onClose}
        onEditingChange={setIsEditing}
        onRefresh={onRefresh}
        onReplace={handleReplace}
        onSave={handleSave}
        t={t}
        weights={policy.weights}
      />
    </>
  );
};

export const WarehouseYardPolicyEditor = ({ onClose, t }: WarehouseYardPolicyEditorProps): ReactElement => {
  const { data: session } = useSessionQuery();
  const query = useYardQueuePolicy();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const organizationName = session?.organizations.find(organization => organization.id === session.actingOrganizationId)?.name;
  const isMember = session?.memberships.some(membership => membership.organizationId === session.actingOrganizationId) === true;
  const policy = isReadAccessDenied(query.error) ? undefined : query.data;

  const handleRefresh = (): void => {
    void query.refetch();
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      className="@container flex w-full max-w-lg min-w-0 flex-col gap-3 rounded-control border border-line p-3"
      data-testid="yard-queue-policy"
    >
      <div>
        <h3 className="font-semibold" ref={headingRef} tabIndex={-1}>{t('warehouseWork.yardPolicyTitle')}</h3>
        <p className="text-sm text-on-panel-muted wrap-anywhere">
          {organizationName === undefined
            ? t('warehouseWork.yardPolicyAllWarehouses')
            : t('warehouseWork.yardPolicyScope', { organization: organizationName })}
        </p>
      </div>
      <WidgetStates
        data={policy}
        error={query.error}
        isRetrying={query.isFetching}
        loadingLabel={t('warehouseWork.yardPolicyLoading')}
        onRetry={handleRefresh}
        skeleton={<Skeleton className="h-24 w-full" />}
      >
        {current => (
          <WarehouseYardPolicyContent
            current={current}
            isMember={isMember}
            isRefreshing={query.isFetching}
            onClose={onClose}
            onRefresh={handleRefresh}
            t={t}
          />
        )}
      </WidgetStates>
      {policy === undefined && (
        <Button data-testid="yard-queue-policy-close" onClick={onClose}>{t('warehouseWork.yardPolicyClose')}</Button>
      )}
    </section>
  );
};
