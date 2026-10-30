import type {
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';
import type {
  ChangeEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { SignatoryBasis } from '@skladburg/contracts/organization/v1/requisites';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type {
  FormFieldBindingValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { useCommandAccess } from '@/entities/session';
import { cn } from '@/shared/lib/cn';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  DateField,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { RequisitesTranslate } from '../../../i18n/requisitesSection';
import type { SignatoryFormValues } from '../../../model/signatoryFormValues';

import { useSignatoryForm } from '../../../api/useSignatoryForm';
import { SIGNATORY_BASIS_OPTIONS } from '../../../config/signatoryBasisOptions';
import { toSignatoryFormValues } from '../../../model/signatoryFormValues';
import { ReloadActualButton } from '../ReloadActualButton';
import { REQUISITES_EDITOR_BLOCK_CLASS_NAME } from '../requisitesStyles';

type SignatoryFieldBinder = (name: FormFieldPathValue<SignatoryFormValues>) => FormFieldBindingValue;

const EDITOR_CLASS_NAME = cn(REQUISITES_EDITOR_BLOCK_CLASS_NAME, 'flex flex-col gap-4');
const EDITOR_TITLE_CLASS_NAME = '-mb-1 text-sm leading-5 font-semibold text-on-panel';
const BASIS_FIELD = 'signatory.basis';
const FULL_NAME_FIELD = 'signatory.fullName';
const POWER_OF_ATTORNEY_BASIS_VALUE = String(SignatoryBasis.POWER_OF_ATTORNEY);
const POWER_OF_ATTORNEY_DATE_MIN = '2000-01-01';
const POWER_OF_ATTORNEY_DATE_MAX = '2100-12-31';

export interface SignatoryEditorProps {
  isDefault: boolean;
  isReloading: boolean;
  onCancel: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onReload: () => void;
  onSaved: (requisites: OrganizationRequisites) => void;
  signatoriesVersion: bigint;
  signatory: Signatory | undefined;
  t: RequisitesTranslate;
}

export const SignatoryEditor = ({
  isDefault,
  isReloading,
  onCancel,
  onDirtyChange,
  onReload,
  onSaved,
  signatoriesVersion,
  signatory,
  t,
}: SignatoryEditorProps): ReactElement => {
  const [signatoryId] = useState(() => signatory?.id ?? crypto.randomUUID());
  const [defaultValues] = useState(() => toSignatoryFormValues(signatory));
  const form = useSignatoryForm({
    defaultValues,
    id: signatoryId,
    isDefault,
    onSaved,
    signatoriesVersion,
    t,
  });
  const access = useCommandAccess(form.command.method);
  const formRef = useRef<HTMLFormElement>(null);
  const headingId = useId();

  const isReadOnly = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isPowerOfAttorney = form.watchField(BASIS_FIELD) === POWER_OF_ATTORNEY_BASIS_VALUE;
  const { isDirty } = form;
  const title = signatory === undefined ? t('requisites.signatories.editor.titleNew') : t('requisites.signatories.editor.titleEdit');

  const bind: SignatoryFieldBinder = (name) => {
    const binding = form.getFieldProps(name);

    return isReadOnly ? { ...binding, isReadOnly: true } : binding;
  };

  const basisBinding = bind(BASIS_FIELD);

  const handleBasisChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    basisBinding.onChange(event);

    if (event.target.value !== POWER_OF_ATTORNEY_BASIS_VALUE) {
      console.log('> SignatoryEditor -> handleBasisChange:', { basis: event.target.value });
      form.setFieldValue('signatory.powerOfAttorneyNumber', '');
      form.setFieldValue('signatory.powerOfAttorneyDate', '');
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> SignatoryEditor -> handleSubmit:', { isReadOnly });

    if (isReadOnly) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  const handleCancelClick = (): void => {
    console.log('> SignatoryEditor -> handleCancelClick:', { isDirty });
    onCancel();
  };

  useEffect(() => {
    const fullNameInput = formRef.current?.elements.namedItem(FULL_NAME_FIELD);

    if (fullNameInput instanceof HTMLElement) {
      fullNameInput.focus();
    }
  }, []);

  useEffect(() => {
    onDirtyChange(isDirty);

    return (): void => {
      onDirtyChange(false);
    };
  }, [isDirty, onDirtyChange]);

  return (
    <form
      aria-labelledby={headingId}
      className={EDITOR_CLASS_NAME}
      data-testid="signatory-editor"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <h4 className={EDITOR_TITLE_CLASS_NAME} id={headingId}>{title}</h4>
      <TextField
        autoComplete="off"
        enterKeyHint="next"
        label={t('requisites.signatories.editor.fullName')}
        spellCheck={false}
        {...bind(FULL_NAME_FIELD)}
      />
      <TextField
        autoComplete="off"
        enterKeyHint="next"
        label={t('requisites.signatories.editor.position')}
        spellCheck={false}
        {...bind('signatory.position')}
      />
      <SelectField label={t('requisites.signatories.editor.basis')} {...basisBinding} onChange={handleBasisChange}>
        {SIGNATORY_BASIS_OPTIONS.map(option => (
          <option key={option.value} value={String(option.value)}>{t(option.labelKey)}</option>
        ))}
      </SelectField>
      {isPowerOfAttorney && (
        <>
          <TextField
            autoComplete="off"
            enterKeyHint="next"
            label={t('requisites.signatories.editor.powerOfAttorneyNumber')}
            spellCheck={false}
            {...bind('signatory.powerOfAttorneyNumber')}
            isOptional={false}
          />
          <DateField
            label={t('requisites.signatories.editor.powerOfAttorneyDate')}
            max={POWER_OF_ATTORNEY_DATE_MAX}
            min={POWER_OF_ATTORNEY_DATE_MIN}
            {...bind('signatory.powerOfAttorneyDate')}
            isOptional={false}
          />
        </>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <ActionButton
          access={access}
          command={form.command}
          data-testid="signatory-save"
          errorPlacement="external"
          type="submit"
        >
          {t('requisites.signatories.editor.save')}
        </ActionButton>
        <Button data-testid="signatory-cancel" onClick={handleCancelClick} variant="secondary">
          {t('requisites.signatories.editor.cancel')}
        </Button>
      </div>
      <CommandErrorNotice command={form.command} />
      {isVersionConflict && (
        <ReloadActualButton isReloading={isReloading} onReload={onReload} t={t} testId="signatory-reload" />
      )}
    </form>
  );
};
