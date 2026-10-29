import {
  describe,
  expect,
  it,
} from 'vitest';

import { canClaimTabFocus } from './claimHelpTabFocus';

interface FakeElementValue {
  name: string;
}

const createElements = (): { body: FakeElementValue; dialog: FakeElementValue; field: FakeElementValue; tab: FakeElementValue } => ({
  body: { name: 'body' },
  dialog: { name: 'dialog' },
  field: { name: 'field' },
  tab: { name: 'tab' },
});

describe('canClaimTabFocus', () => {
  it('claims focus when nothing is focused', () => {
    const { body, dialog, tab } = createElements();

    expect(canClaimTabFocus({
      activeElement: null,
      bodyElement: body,
      dialogElement: dialog,
      tabElement: tab,
    })).toBe(true);
  });

  it('claims focus from the page body, the panel dialog and the tab itself', () => {
    const { body, dialog, tab } = createElements();

    for (const activeElement of [body, dialog, tab]) {
      expect(canClaimTabFocus({
        activeElement,
        bodyElement: body,
        dialogElement: dialog,
        tabElement: tab,
      })).toBe(true);
    }
  });

  it('keeps focus that already moved inside the help content', () => {
    const { body, dialog, field, tab } = createElements();

    expect(canClaimTabFocus({
      activeElement: field,
      bodyElement: body,
      dialogElement: dialog,
      tabElement: tab,
    })).toBe(false);
  });

  it('keeps focus on another element when there is no dialog', () => {
    const { body, field, tab } = createElements();

    expect(canClaimTabFocus({
      activeElement: field,
      bodyElement: body,
      dialogElement: null,
      tabElement: tab,
    })).toBe(false);
  });
});
