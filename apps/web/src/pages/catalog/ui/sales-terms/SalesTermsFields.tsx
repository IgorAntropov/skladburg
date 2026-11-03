import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';
import type {
  KeyboardEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useId,
  useRef,
} from 'react';

import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { useCommandAccess } from '@/entities/session';
import {
  createMoneyMask,
  createWholeNumberMask,
} from '@/shared/lib/mask';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  LeaveConfirm,
  SwitchField,
  TextField,
} from '@/shared/ui';

import type { SalesTermsFormValues } from '../../lib/salesTermsFormValues';

import { useSaveSalesTermsForm } from '../../api/editor/useSaveSalesTermsForm';
import { isLeavingCatalog } from '../../lib/isLeavingCatalog';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditorTexts } from '../../model/useEditorTexts';
import { EditorReloadButton } from '../editor-shared/EditorReloadButton';
import {
  EDITOR_FIELDS_CLASS_NAME,
  EDITOR_FORM_ACTIONS_CLASS_NAME,
  EDITOR_SAVE_BUTTON_CLASS_NAME,
} from '../editor-shared/editorStyles';
import { RuleErrorNotice } from '../editor-shared/RuleErrorNotice';

interface SalesTermsFieldsProps {
  isReloading: boolean;
  onClose: () => void;
  onReload: () => void;
  onSaved: (saved: SalesTerms) => void;
  terms: SalesTerms;
}

type SwitchFieldPathValue = 'hasOwnDelivery' | 'isAutoConfirmEnabled';

const MONEY_MASK = createMoneyMask();

const WHOLE_NUMBER_MASK = createWholeNumberMask();

const PREPARATION_DAYS_SELECTOR = '[data-testid="sales-terms-preparation-days"] input';

export const SalesTermsFields = ({
  isReloading,
  onClose,
  onReload,
  onSaved,
  terms,
}: SalesTermsFieldsProps): ReactElement => {
  const { t: pageT } = useCatalogTexts();
  const t = useEditorTexts();
  const titleId = useId();
  const deliveryFieldsId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const form = useSaveSalesTermsForm({ onSaved, t, terms });
  const access = useCommandAccess(form.command.method);
  const {
    cancelLeave,
    confirmLeave,
    isLeavePending,
    requestLeave,
  } = useNavigationGuard(form.isDirty, isLeavingCatalog);

  const hasOwnDelivery = form.watchField('hasOwnDelivery');
  const { isPending } = form.command;
  const isAccessDenied = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;

  const bind = (name: FormFieldPathValue<SalesTermsFormValues>, options?: FormFieldOptionsValue): FormFieldBindingValue => {
    const binding = { ...form.getFieldProps(name, options), isOptional: false };

    return isAccessDenied ? { ...binding, isReadOnly: true } : binding;
  };

  const bindSwitch = (name: SwitchFieldPathValue): Omit<FormFieldBindingValue, 'isOptional' | 'mask' | 'onInput'> => {
    const { error, isReadOnly, name: fieldName, onBlur, onChange, ref } = bind(name);

    return { error, isReadOnly, name: fieldName, onBlur, onChange, ref };
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> SalesTermsFields -> handleSubmit:', { isAccessDenied });

    if (isAccessDenied) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  const handleCancelClick = (): void => {
    console.log('> SalesTermsFields -> handleCancelClick:', { isPending });
    requestLeave(onClose);
  };

  const handleStayClick = (): void => {
    console.log('> SalesTermsFields -> handleStayClick:', {});
    cancelLeave();
    cancelRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    console.log('> SalesTermsFields -> handleKeyDown:', { isPending });
    event.preventDefault();

    if (isLeavePending) {
      handleStayClick();

      return;
    }

    if (!isPending) {
      requestLeave(onClose);
    }
  };

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(PREPARATION_DAYS_SELECTOR)?.focus();
  }, []);

  return (
    <form
      aria-labelledby={titleId}
      className="flex max-w-md flex-col gap-4"
      data-testid="sales-terms-form"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <h2 className="text-base leading-6 font-semibold text-on-panel" id={titleId}>{pageT('catalog.terms.title')}</h2>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="sales-terms-leave-confirm"
          leaveLabel={t('catalogEditor.leave.confirm')}
          message={t('catalogEditor.leave.message')}
          onLeave={confirmLeave}
          onStay={handleStayClick}
          stayLabel={t('catalogEditor.leave.stay')}
        />
      )}
      <div className={EDITOR_FIELDS_CLASS_NAME}>
        <div data-testid="sales-terms-preparation-days">
          <TextField
            {...bind('preparationWorkingDays', { mask: WHOLE_NUMBER_MASK })}
            autoComplete="off"
            enterKeyHint={hasOwnDelivery ? 'next' : 'done'}
            hint={t('catalogEditor.terms.preparationDaysHint')}
            label={t('catalogEditor.terms.preparationDays')}
          />
        </div>
        <SwitchField
          {...bindSwitch('isAutoConfirmEnabled')}
          data-testid="sales-terms-auto-confirm"
          hint={t('catalogEditor.terms.autoConfirmHint')}
          label={t('catalogEditor.terms.autoConfirm')}
        />
        <SwitchField
          {...bindSwitch('hasOwnDelivery')}
          aria-controls={deliveryFieldsId}
          data-testid="sales-terms-own-delivery"
          hint={t('catalogEditor.terms.ownDeliveryHint')}
          label={t('catalogEditor.terms.ownDelivery')}
        />
        <div className={EDITOR_FIELDS_CLASS_NAME} hidden={!hasOwnDelivery} id={deliveryFieldsId}>
          <div data-testid="sales-terms-price-per-km">
            <TextField
              {...bind('ownDelivery.pricePerKm.amountMinor', { mask: MONEY_MASK })}
              autoComplete="off"
              enterKeyHint="next"
              label={t('catalogEditor.terms.pricePerKm')}
            />
          </div>
          <div data-testid="sales-terms-minimum-charge">
            <TextField
              {...bind('ownDelivery.minimumCharge.amountMinor', { mask: MONEY_MASK })}
              autoComplete="off"
              enterKeyHint="done"
              hint={t('catalogEditor.terms.minimumChargeHint')}
              label={t('catalogEditor.terms.minimumCharge')}
            />
          </div>
        </div>
      </div>
      <div className={EDITOR_FORM_ACTIONS_CLASS_NAME}>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            access={access}
            className={EDITOR_SAVE_BUTTON_CLASS_NAME}
            command={form.command}
            data-testid="sales-terms-save"
            errorPlacement="external"
            type="submit"
            variant="primary"
          >
            {t('catalogEditor.terms.save')}
          </ActionButton>
          <Button
            aria-disabled={isPending}
            data-testid="sales-terms-cancel"
            onClick={handleCancelClick}
            ref={cancelRef}
            variant="secondary"
          >
            {t('catalogEditor.terms.cancel')}
          </Button>
        </div>
        <RuleErrorNotice command={form.command} />
        {isVersionConflict && (
          <EditorReloadButton isReloading={isReloading} onReload={onReload} testId="sales-terms-reload" />
        )}
      </div>
    </form>
  );
};
