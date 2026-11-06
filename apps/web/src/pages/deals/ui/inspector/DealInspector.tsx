import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import {
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useSessionQuery } from '@/entities/session';
import { useActingContext } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';
import type { DealEditorValue } from './dealInspectorTypes';

import { dealInspectorSection } from '../../i18n/inspectorSection';
import { DealStatusBadge } from '../DealStatusBadge';
import { ApproveDealButton } from './ApproveDealButton';
import { getDealActions } from './dealActionAvailability';
import { DealActionOpenButton } from './DealActionOpenButton';
import { DealEditor } from './DealEditor';
import { DealHistory } from './DealHistory';
import { DealTerms } from './DealTerms';

interface DealInspectorBodyProps extends DealInspectorProps {
  t: DealInspectorTranslate;
}

interface DealInspectorProps extends DealCommandContextValue {
  counterpartyName: string | undefined;
}

const DealInspectorBody = ({ counterpartyName, deal, onRefresh, onUpdated, t }: DealInspectorBodyProps): ReactElement => {
  const { organizationId } = useActingContext();
  const { data: session } = useSessionQuery();
  const [editor, setEditor] = useState<DealEditorValue | undefined>(undefined);
  const actionListRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<'status' | DealEditorValue | undefined>(undefined);

  const isCustomer = organizationId === deal.customerOrganizationId;
  const isSupplier = organizationId === deal.supplierOrganizationId;
  const party = isCustomer ? 'customer' : (isSupplier ? 'supplier' : undefined);
  const actions = getDealActions(deal.status, party);
  const hasActions = editor === undefined && actions.length > 0;
  const ownCompany = session?.organizations.find(organization => organization.id === organizationId)?.name
    ?? t('dealInspector.ownCompany');
  const otherCompany = counterpartyName ?? t('dealInspector.notSpecified');

  const handleClose = (): void => {
    pendingFocusRef.current = editor;
    setEditor(undefined);
  };

  const handleUpdated = (updated: Deal): void => {
    if (editor !== undefined && editorRef.current?.contains(document.activeElement) === true) {
      pendingFocusRef.current = getDealActions(updated.status, party).includes(editor) ? editor : 'status';
    }

    onUpdated(updated);
    setEditor(undefined);
  };

  const handleRequestStatusFocus = (): void => {
    pendingFocusRef.current = 'status';
  };

  useLayoutEffect(() => {
    const target = pendingFocusRef.current;
    if (editor !== undefined || target === undefined) {
      return;
    }

    pendingFocusRef.current = undefined;
    const action = target === 'status'
      ? undefined
      : actionListRef.current?.querySelector<HTMLButtonElement>(`[data-deal-action="${target}"]`);
    (action ?? statusRef.current)?.focus();
  }, [deal.status, editor]);

  return (
    <div className="flex min-w-0 flex-col gap-4 text-on-panel">
      <div className="self-start" data-status={deal.status} data-testid="deal-status" ref={statusRef} tabIndex={-1}>
        <DealStatusBadge status={deal.status} />
      </div>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap justify-between gap-x-2 wrap-break-word">
          <dt className="text-on-panel-muted">{t('dealInspector.customer')}</dt>
          <dd className="font-medium">{isCustomer ? ownCompany : otherCompany}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-2 wrap-break-word">
          <dt className="text-on-panel-muted">{t('dealInspector.supplier')}</dt>
          <dd className="font-medium">{isSupplier ? ownCompany : otherCompany}</dd>
        </div>
      </dl>
      <DealTerms deal={deal} t={t} />
      <DealHistory deal={deal} t={t} />
      {editor !== undefined && (
        <div ref={editorRef}>
          <DealEditor
            action={editor}
            deal={deal}
            isCurrentAction={actions.includes(editor)}
            onClose={handleClose}
            onRefresh={onRefresh}
            onUpdated={handleUpdated}
            t={t}
          />
        </div>
      )}
      {hasActions && (
        <section className="flex flex-col gap-2" ref={actionListRef}>
          <h3 className="text-base font-semibold">{t('dealInspector.actions')}</h3>
          {actions.map(action => action === 'submit' || action === 'accept'
            ? (
                <ApproveDealButton
                  deal={deal}
                  key={`${action}-${String(deal.version)}`}
                  kind={action === 'submit' ? 'submitDeal' : 'acceptCounterOffer'}
                  onRefresh={onRefresh}
                  onRequestStatusFocus={handleRequestStatusFocus}
                  onUpdated={onUpdated}
                  t={t}
                />
              )
            : <DealActionOpenButton action={action} deal={deal} key={action} onOpen={setEditor} t={t} />)}
        </section>
      )}
    </div>
  );
};

export const DealInspector = (props: DealInspectorProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealInspectorSection);

  if (t !== undefined) {
    return <DealInspectorBody {...props} key={props.deal.id} t={t} />;
  }

  if (status === 'error') {
    return <ErrorNotice error={null} onRetry={retry} />;
  }

  return (
    <SkeletonGroup isFilled label={baseText('object.type.deal')}>
      <Skeleton shape="block" />
    </SkeletonGroup>
  );
};
