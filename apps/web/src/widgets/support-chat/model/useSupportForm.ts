import type { SupportTicketContext } from '@skladburg/contracts/support/v1/support_ticket';

import { useEffect } from 'react';

import { useActingContext } from '@/shared/api';

import type { SupportSelectableCategoryValue } from '../lib/supportCategories';
import type { SupportFormDraftValue } from './useSupportFormStore';

import { useSupportFormStore } from './useSupportFormStore';

export interface SupportFormValue {
  close: () => void;
  consumeFocus: () => void;
  draft: SupportFormDraftValue | undefined;
  open: (context: SupportTicketContext) => void;
  selectCategory: (category: SupportSelectableCategoryValue) => void;
}

export const useSupportForm = (): SupportFormValue => {
  const { organizationId, userId } = useActingContext();
  const scope = `${userId ?? ''}|${organizationId ?? ''}`;

  const draft = useSupportFormStore(state => (state.draft?.scope === scope ? state.draft : undefined));
  const close = useSupportFormStore(state => state.close);
  const consumeFocus = useSupportFormStore(state => state.consumeFocus);
  const openDraft = useSupportFormStore(state => state.open);
  const selectCategory = useSupportFormStore(state => state.selectCategory);
  const syncScope = useSupportFormStore(state => state.syncScope);

  const open = (context: SupportTicketContext): void => {
    openDraft({ context, scope });
  };

  useEffect(() => {
    syncScope(scope);
  }, [scope, syncScope]);

  return { close, consumeFocus, draft, open, selectCategory };
};
