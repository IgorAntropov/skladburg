import type {
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { SignatoryBasis } from '@skladburg/contracts/organization/v1/requisites';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  AccessButton,
  ActionButton,
  Button,
} from '@/shared/ui';

import type { RequisitesTranslate } from '../../../i18n/requisitesSection';

import { useSignatoryCommands } from '../../../api/useSignatoryCommands';
import { ReloadActualButton } from '../ReloadActualButton';
import {
  REQUISITES_CONFIRM_CLASS_NAME,
  REQUISITES_NOTE_CLASS_NAME,
  REQUISITES_READ_ONLY_BLOCK_CLASS_NAME,
} from '../requisitesStyles';

const ITEM_CLASS_NAME = cn(REQUISITES_READ_ONLY_BLOCK_CLASS_NAME, 'flex flex-col gap-1');

const DEFAULT_BADGE_CLASS_NAME = [
  'inline-flex shrink-0 items-center rounded-full border border-transparent bg-hover px-2.5 py-0.5',
  'text-sm leading-5 font-medium text-on-panel',
].join(' ');

export interface SignatoryItemProps {
  consumeFocusRequest: (signatoryId: string) => boolean;
  isBlocked: boolean;
  isReloading: boolean;
  onChanged: (requisites: OrganizationRequisites, signatoryId: string) => void;
  onEdit: (signatoryId: string) => void;
  onReload: () => void;
  signatoriesVersion: bigint;
  signatory: Signatory;
  t: RequisitesTranslate;
}

export const SignatoryItem = ({
  consumeFocusRequest,
  isBlocked,
  isReloading,
  onChanged,
  onEdit,
  onReload,
  signatoriesVersion,
  signatory,
  t,
}: SignatoryItemProps): ReactElement => {
  const { formatCalendarDate } = useI18n();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [isRemoveConfirmShown, setIsRemoveConfirmShown] = useState(false);

  const { id, isDefault } = signatory;

  const handleSaved = (requisites: OrganizationRequisites): void => {
    editButtonRef.current?.focus();
    onChanged(requisites, id);
  };

  const {
    makeDefault,
    remove,
    removeAccess,
    saveAccess,
  } = useSignatoryCommands({
    onSaved: handleSaved,
    signatoriesVersion,
    signatory,
    t,
  });

  const isPowerOfAttorney = signatory.basis === SignatoryBasis.POWER_OF_ATTORNEY;
  const { powerOfAttorneyDate } = signatory;
  const powerOfAttorneyText = isPowerOfAttorney && signatory.powerOfAttorneyNumber !== '' && powerOfAttorneyDate !== undefined
    ? t('requisites.signatories.powerOfAttorney', {
        date: formatCalendarDate(powerOfAttorneyDate),
        number: signatory.powerOfAttorneyNumber,
      })
    : undefined;
  const basisText = isPowerOfAttorney
    ? t('requisites.signatories.basis.powerOfAttorney')
    : t('requisites.signatories.basis.charter');
  const isVersionConflict = makeDefault.apiError?.code === ErrorCode.VERSION_CONFLICT
    || remove.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isRemoveTriggerShown = !isDefault && !isRemoveConfirmShown;

  const handleEditClick = (): void => {
    console.log('> SignatoryItem -> handleEditClick:', { signatoryId: id });
    onEdit(id);
  };

  const handleRemoveClick = (): void => {
    console.log('> SignatoryItem -> handleRemoveClick:', { signatoryId: id });
    setIsRemoveConfirmShown(true);
  };

  const handleRemoveCancelClick = (): void => {
    console.log('> SignatoryItem -> handleRemoveCancelClick:', { signatoryId: id });
    remove.reset();
    setIsRemoveConfirmShown(false);
    editButtonRef.current?.focus();
  };

  useEffect(() => {
    if (isRemoveConfirmShown) {
      confirmRef.current?.focus();
    }
  }, [isRemoveConfirmShown]);

  useEffect(() => {
    if (consumeFocusRequest(id)) {
      editButtonRef.current?.focus();
    }
  }, [consumeFocusRequest, id]);

  return (
    <li className={ITEM_CLASS_NAME} data-testid={`requisites-signatory-${id}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 text-base leading-6 font-medium wrap-break-word text-on-panel">{signatory.fullName}</span>
        {isDefault && (
          <span className={DEFAULT_BADGE_CLASS_NAME}>
            {t('requisites.signatories.default')}
          </span>
        )}
      </div>
      <span className="text-sm leading-5 wrap-break-word text-on-panel-muted">{signatory.position}</span>
      <span className="text-sm leading-5 wrap-break-word text-on-panel-muted">{powerOfAttorneyText ?? basisText}</span>
      <div className="flex flex-wrap items-start gap-2 pt-1">
        <AccessButton
          access={saveAccess}
          data-testid={`requisites-signatory-edit-${id}`}
          isDisabled={isBlocked}
          onClick={handleEditClick}
          ref={editButtonRef}
          variant="secondary"
        >
          {t('requisites.signatories.edit')}
        </AccessButton>
        {!isDefault && (
          <ActionButton
            access={saveAccess}
            command={makeDefault}
            data-testid={`requisites-signatory-default-${id}`}
            isDisabled={isBlocked}
            variant="secondary"
          >
            {t('requisites.signatories.makeDefault')}
          </ActionButton>
        )}
        {isRemoveTriggerShown && (
          <AccessButton
            access={removeAccess}
            data-testid={`requisites-signatory-remove-${id}`}
            isDisabled={isBlocked}
            onClick={handleRemoveClick}
            variant="secondary"
          >
            {t('requisites.signatories.remove')}
          </AccessButton>
        )}
      </div>
      {isDefault && <p className={REQUISITES_NOTE_CLASS_NAME}>{t('requisites.signatories.defaultNote')}</p>}
      {isRemoveConfirmShown && (
        <div
          className={cn(REQUISITES_CONFIRM_CLASS_NAME, 'mt-1')}
          data-testid={`requisites-signatory-remove-confirmation-${id}`}
          ref={confirmRef}
          role="group"
          tabIndex={-1}
        >
          <p className="text-base leading-6 text-on-panel">
            {t('requisites.signatories.removeConfirm', { name: signatory.fullName })}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <ActionButton
              access={removeAccess}
              command={remove}
              data-testid={`requisites-signatory-remove-confirm-${id}`}
              errorPlacement="below"
              isDisabled={isBlocked}
              variant="primary"
            >
              {t('requisites.signatories.remove')}
            </ActionButton>
            <Button onClick={handleRemoveCancelClick} variant="secondary">
              {t('requisites.signatories.removeCancel')}
            </Button>
          </div>
        </div>
      )}
      {isVersionConflict && (
        <ReloadActualButton
          isReloading={isReloading}
          onReload={onReload}
          t={t}
          testId={`requisites-signatory-reload-${id}`}
        />
      )}
    </li>
  );
};
