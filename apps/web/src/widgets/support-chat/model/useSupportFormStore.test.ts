import { create } from '@bufbuild/protobuf';
import {
  SupportErrorRefSchema,
  SupportTicketCategory,
  SupportTicketContextSchema,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useSupportFormStore } from './useSupportFormStore';

const createContext = (errorCount: number, screenPath = '/network'): ReturnType<typeof create<typeof SupportTicketContextSchema>> => (
  create(SupportTicketContextSchema, {
    errors: Array.from({ length: errorCount }, () => create(SupportErrorRefSchema, {})),
    screenPath,
  })
);

const getState = (): ReturnType<typeof useSupportFormStore.getState> => useSupportFormStore.getState();

describe('useSupportFormStore', () => {
  beforeEach(() => {
    useSupportFormStore.setState({ draft: undefined });
  });

  it('opens a draft with the general category and a focus request when the journal is empty', () => {
    const context = createContext(0);

    getState().open({ context, scope: 'user-1|org-1' });

    expect(getState().draft).toEqual({
      category: SupportTicketCategory.GENERAL,
      context,
      isFocusPending: true,
      scope: 'user-1|org-1',
    });
  });

  it('opens a draft with the error category when the journal has failures', () => {
    getState().open({ context: createContext(2), scope: 'user-1|org-1' });

    expect(getState().draft?.category).toBe(SupportTicketCategory.ERROR);
  });

  it('keeps the context captured at opening while the category changes', () => {
    const context = createContext(0);

    getState().open({ context, scope: 'user-1|org-1' });
    getState().selectCategory(SupportTicketCategory.MONEY);

    expect(getState().draft?.category).toBe(SupportTicketCategory.MONEY);
    expect(getState().draft?.context).toBe(context);
  });

  it('hands the focus request out once', () => {
    getState().open({ context: createContext(0), scope: 'user-1|org-1' });
    getState().consumeFocus();

    expect(getState().draft?.isFocusPending).toBe(false);

    const { draft } = getState();

    getState().consumeFocus();

    expect(getState().draft).toBe(draft);
  });

  it('ignores a category and a focus request while no draft is open', () => {
    getState().selectCategory(SupportTicketCategory.MONEY);
    getState().consumeFocus();

    expect(getState().draft).toBeUndefined();
  });

  it('drops the draft on cancel and after a successful send', () => {
    getState().open({ context: createContext(0), scope: 'user-1|org-1' });
    getState().close();

    expect(getState().draft).toBeUndefined();
  });

  it('keeps the draft while the acting scope stays the same', () => {
    getState().open({ context: createContext(0), scope: 'user-1|org-1' });

    const { draft } = getState();

    getState().syncScope('user-1|org-1');

    expect(getState().draft).toBe(draft);
  });

  it.each([
    ['user-2|org-1'],
    ['user-1|org-2'],
  ])('drops the draft when the acting scope turns into %s', (scope) => {
    getState().open({ context: createContext(0), scope: 'user-1|org-1' });
    getState().syncScope(scope);

    expect(getState().draft).toBeUndefined();
  });

  it('replaces the draft when the form is opened again', () => {
    getState().open({ context: createContext(0, '/network'), scope: 'user-1|org-1' });
    getState().selectCategory(SupportTicketCategory.MONEY);
    getState().open({ context: createContext(0, '/warehouse'), scope: 'user-1|org-1' });

    expect(getState().draft?.category).toBe(SupportTicketCategory.GENERAL);
    expect(getState().draft?.context.screenPath).toBe('/warehouse');
  });
});
