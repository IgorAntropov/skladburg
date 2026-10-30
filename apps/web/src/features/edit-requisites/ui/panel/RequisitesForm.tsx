import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { useId } from 'react';

import { useCommandAccess } from '@/entities/session';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  SelectField,
} from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';
import type { RequisitesFieldBinder } from './requisitesFormTypes';

import { useRequisitesForm } from '../../api/useRequisitesForm';
import { VAT_MODE_OPTIONS } from '../../config/vatModeOptions';
import { LegalAddressField } from './LegalAddressField';
import { RequisitesBankSection } from './RequisitesBankSection';
import { RequisitesCompanyBlock } from './RequisitesCompanyBlock';
import { RequisitesSignatoriesList } from './RequisitesSignatoriesList';
import {
  REQUISITES_ACTIONS_CLASS_NAME,
  REQUISITES_GROUP_CLASS_NAME,
  REQUISITES_GROUP_HEADING_CLASS_NAME,
} from './requisitesStyles';

export interface RequisitesFormProps {
  isReloading: boolean;
  onReload: () => void;
  onSaved: (requisites: OrganizationRequisites) => void;
  requisites: OrganizationRequisites;
  t: RequisitesTranslate;
}

export const RequisitesForm = ({
  isReloading,
  onReload,
  onSaved,
  requisites,
  t,
}: RequisitesFormProps): ReactElement => {
  const form = useRequisitesForm({ onSaved, requisites, t });
  const access = useCommandAccess(form.command.method);
  const legalHeadingId = useId();

  const isReadOnly = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;

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

  const handleReloadClick = (): void => {
    console.log('> RequisitesForm -> handleReloadClick:', { version: String(requisites.version) });
    onReload();
  };

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
      <RequisitesSignatoriesList signatories={requisites.signatories} t={t} />
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
          <Button
            data-testid="requisites-reload"
            onClick={handleReloadClick}
            pending={isReloading}
            pendingLabel={t('requisites.reloading')}
            variant="secondary"
          >
            {t('requisites.reload')}
          </Button>
        )}
      </div>
    </form>
  );
};
