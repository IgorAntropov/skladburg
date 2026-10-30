import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useId,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import {
  ActionButton,
  CommandErrorNotice,
  SelectField,
} from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';
import type { RequisitesFieldBinder } from './requisitesFormTypes';

import { useRequisitesForm } from '../../api/useRequisitesForm';
import { VAT_MODE_OPTIONS } from '../../config/vatModeOptions';
import { LegalAddressField } from './LegalAddressField';
import { ReloadActualButton } from './ReloadActualButton';
import { RequisitesBankSection } from './RequisitesBankSection';
import { RequisitesCompanyBlock } from './RequisitesCompanyBlock';
import {
  REQUISITES_ACTIONS_CLASS_NAME,
  REQUISITES_GROUP_CLASS_NAME,
  REQUISITES_GROUP_HEADING_CLASS_NAME,
} from './requisitesStyles';

export interface RequisitesFormProps {
  formVersion: bigint;
  isReloading: boolean;
  onDirtyChange: (isDirty: boolean) => void;
  onReload: () => void;
  onSaved: (requisites: OrganizationRequisites) => void;
  requisites: OrganizationRequisites;
  t: RequisitesTranslate;
}

export const RequisitesForm = ({
  formVersion,
  isReloading,
  onDirtyChange,
  onReload,
  onSaved,
  requisites,
  t,
}: RequisitesFormProps): ReactElement => {
  const form = useRequisitesForm({
    formVersion,
    onSaved,
    requisites,
    t,
  });
  const access = useCommandAccess(form.command.method);
  const legalHeadingId = useId();

  const isReadOnly = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const { isDirty } = form;

  const bind: RequisitesFieldBinder = (name, options) => {
    const binding = form.getFieldProps(name, options);

    return isReadOnly ? { ...binding, isReadOnly: true } : binding;
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> RequisitesForm -> handleSubmit:', { isReadOnly });

    if (isReadOnly) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  useEffect(() => {
    onDirtyChange(isDirty);

    return (): void => {
      onDirtyChange(false);
    };
  }, [isDirty, onDirtyChange]);

  return (
    <form className="flex flex-col gap-4" data-testid="requisites-form" noValidate onSubmit={handleSubmit}>
      <RequisitesCompanyBlock t={t} timeZone={requisites.timeZone} />
      <section aria-labelledby={legalHeadingId} className={REQUISITES_GROUP_CLASS_NAME} data-testid="requisites-legal">
        <h3 className={REQUISITES_GROUP_HEADING_CLASS_NAME} id={legalHeadingId}>{t('requisites.legal.title')}</h3>
        <LegalAddressField label={t('requisites.legalAddress')} {...bind('legalAddress')} />
        <SelectField label={t('requisites.vatMode')} {...bind('vatMode')}>
          <option value="" />
          {VAT_MODE_OPTIONS.map(option => (
            <option key={option.value} value={String(option.value)}>{t(option.labelKey)}</option>
          ))}
        </SelectField>
      </section>
      <RequisitesBankSection bind={bind} t={t} />
      <div className={REQUISITES_ACTIONS_CLASS_NAME}>
        <ActionButton
          access={access}
          command={form.command}
          data-testid="requisites-submit"
          errorPlacement="external"
          type="submit"
        >
          {t('requisites.save')}
        </ActionButton>
        <CommandErrorNotice command={form.command} />
        {isVersionConflict && (
          <ReloadActualButton isReloading={isReloading} onReload={onReload} t={t} testId="requisites-reload" />
        )}
      </div>
    </form>
  );
};
