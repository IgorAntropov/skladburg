import type { SupportTicket } from '@skladburg/contracts/support/v1/support_ticket';
import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
  SubmitEvent,
} from 'react';

import {
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import {
  useCommandAccess,
  useSessionQuery,
} from '@/entities/session';
import { useCreateSupportTicket } from '@/entities/support-ticket';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  SelectField,
} from '@/shared/ui';

import type { SupportSelectableCategoryValue } from '../../lib/supportCategories';
import type { SupportTranslate } from '../../lib/supportTranslate';
import type { SupportFormDraftValue } from '../../model/useSupportFormStore';

import { selectActingOrganizationName } from '../../lib/selectActingOrganizationName';
import {
  findSupportCategory,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_DESCRIPTORS,
  SUPPORT_RESPONSE_HOURS,
} from '../../lib/supportCategories';
import {
  SupportContextRow,
  SupportContextRows,
} from './SupportContextRows';
import { SupportUrgentBadge } from './SupportUrgentBadge';

interface SupportCallFormProps {
  draft: SupportFormDraftValue;
  onCancel: () => void;
  onCategoryChange: (category: SupportSelectableCategoryValue) => void;
  onCreated: (ticket: SupportTicket) => void;
  onFocusHandled: () => void;
  t: SupportTranslate;
}

const ACTIONS_CLASS_NAME = '-mx-3 -bottom-3 -mb-3 sticky flex flex-col gap-3 border-t border-line bg-panel-solid px-3 py-3';

export const SupportCallForm = ({
  draft,
  onCancel,
  onCategoryChange,
  onCreated,
  onFocusHandled,
  t,
}: SupportCallFormProps): ReactElement => {
  const { category, context, isFocusPending } = draft;
  const { data: organizationName } = useSessionQuery({ select: selectActingOrganizationName });
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleCreated = (response: { ticket?: SupportTicket | undefined }): void => {
    console.log('> SupportCallForm -> handleCreated:', { ticketId: response.ticket?.id });
    if (response.ticket !== undefined) {
      onCreated(response.ticket);
    }
  };

  const command = useCreateSupportTicket({ category, context, onSuccess: handleCreated });
  const access = useCommandAccess(command.method);

  const descriptor = SUPPORT_CATEGORY_DESCRIPTORS[category];
  const isCancelBlocked = command.isPending;
  const responseHours = descriptor.isUrgent ? SUPPORT_RESPONSE_HOURS.urgent : SUPPORT_RESPONSE_HOURS.normal;

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextCategory = findSupportCategory(event.target.value);

    console.log('> SupportCallForm -> handleCategoryChange:', { nextCategory });
    if (nextCategory !== undefined) {
      onCategoryChange(nextCategory);
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    console.log('> SupportCallForm -> handleSubmit:', { category });
    command.run();
  };

  const handleCancelClick = (): void => {
    console.log('> SupportCallForm -> handleCancelClick:', { isCancelBlocked });
    onCancel();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    console.log('> SupportCallForm -> handleKeyDown:', { isCancelBlocked, key: event.key });

    if (!isCancelBlocked) {
      onCancel();
    }
  };

  useEffect(() => {
    if (isFocusPending) {
      selectRef.current?.focus();
      onFocusHandled();
    }
  }, [isFocusPending, onFocusHandled]);

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="support-call-form"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t('support.form.title')}</h2>
        <p className="text-sm text-pretty text-on-panel-muted">{t('support.form.intro')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <SelectField
          hint={t(descriptor.hintKey)}
          label={t('support.form.category')}
          name="category"
          onChange={handleCategoryChange}
          ref={selectRef}
          value={String(category)}
        >
          {SUPPORT_CATEGORIES.map(option => (
            <option key={option} value={String(option)}>{t(SUPPORT_CATEGORY_DESCRIPTORS[option].optionKey)}</option>
          ))}
        </SelectField>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Clock aria-hidden className="size-4 shrink-0" />
          {descriptor.isUrgent && <SupportUrgentBadge t={t} />}
          <span className={descriptor.isUrgent ? 'font-medium text-on-panel' : 'text-on-panel-muted'}>
            {t(descriptor.isUrgent ? 'support.response.urgent' : 'support.response.normal', { count: responseHours })}
          </span>
        </p>
      </div>
      <section className="flex flex-col gap-3 rounded-control border border-line p-3" data-testid="support-call-preview">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Eye aria-hidden className="size-4 shrink-0" />
          {t('support.preview.title')}
        </h3>
        <SupportContextRows context={context} t={t}>
          {organizationName !== undefined && (
            <SupportContextRow label={t('support.preview.session')}>
              <span>{organizationName}</span>
              <span className="block text-on-panel-muted">{t('support.preview.session.note')}</span>
            </SupportContextRow>
          )}
        </SupportContextRows>
        <p className="flex items-center gap-2 border-t border-line pt-2 text-sm font-medium text-on-panel">
          <EyeOff aria-hidden className="size-4 shrink-0" />
          {t('support.preview.noPersonalData')}
        </p>
      </section>
      <div className={ACTIONS_CLASS_NAME}>
        <div className="flex flex-wrap items-start gap-3">
          <ActionButton
            access={access}
            command={command}
            data-testid="support-call-submit"
            errorPlacement="external"
            pendingLabel={t('support.action.sending')}
            type="submit"
            variant="primary"
          >
            {t('support.action.send')}
          </ActionButton>
          <Button
            aria-disabled={isCancelBlocked}
            data-testid="support-call-cancel"
            onClick={handleCancelClick}
            variant="secondary"
          >
            {t('support.action.cancel')}
          </Button>
        </div>
        <CommandErrorNotice command={command} />
      </div>
    </form>
  );
};
