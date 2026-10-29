import type { SupportTicketContext } from '@skladburg/contracts/support/v1/support_ticket';

import { create } from 'zustand';

import type { SupportSelectableCategoryValue } from '../lib/supportCategories';

import { resolveDefaultSupportCategory } from '../lib/supportCategories';

export interface OpenSupportFormInputValue {
  context: SupportTicketContext;
  scope: string;
}

export interface SupportFormDraftValue {
  category: SupportSelectableCategoryValue;
  context: SupportTicketContext;
  isFocusPending: boolean;
  scope: string;
}

interface SupportFormState {
  close: () => void;
  consumeFocus: () => void;
  draft: SupportFormDraftValue | undefined;
  open: (input: OpenSupportFormInputValue) => void;
  selectCategory: (category: SupportSelectableCategoryValue) => void;
  syncScope: (scope: string) => void;
}

export const useSupportFormStore = create<SupportFormState>()(set => ({
  close: () => {
    set({ draft: undefined });
  },
  consumeFocus: () => {
    set(state => (state.draft?.isFocusPending === true ? { draft: { ...state.draft, isFocusPending: false } } : state));
  },
  draft: undefined,
  open: ({ context, scope }) => {
    set({
      draft: {
        category: resolveDefaultSupportCategory(context.errors.length > 0),
        context,
        isFocusPending: true,
        scope,
      },
    });
  },
  selectCategory: (category) => {
    set(state => (state.draft === undefined ? state : { draft: { ...state.draft, category } }));
  },
  syncScope: (scope) => {
    set(state => (state.draft === undefined || state.draft.scope === scope ? state : { draft: undefined }));
  },
}));
