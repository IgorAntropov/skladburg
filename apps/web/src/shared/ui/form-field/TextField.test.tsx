import { render } from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { createDigitMask } from '@/shared/lib/mask';

import { TextField } from './TextField';

const LABEL = 'Счёт';
const CUSTOM_PLACEHOLDER = 'Счёт в банке';
const TEMPLATE = '00000 000 0 0000 0000000';
const ACCOUNT = '40702810000000000001';
const FORMATTED_ACCOUNT = '40702 810 0 0000 0000001';

const MASK = createDigitMask('##### ### # #### #######');

const getInput = (container: HTMLElement): HTMLInputElement => {
  const element = container.querySelector('input');

  if (element === null) {
    throw new Error('The field is not rendered');
  }

  return element;
};

describe('TextField with a mask', () => {
  it('shows the template, asks for digits and turns the spell check off', () => {
    const { container } = render(withTestLocalizer(<TextField label={LABEL} mask={MASK} name="account" />));
    const input = getInput(container);

    expect(input.placeholder).toBe(TEMPLATE);
    expect(input.inputMode).toBe('numeric');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('formats the value that the program put into the field on the next render', () => {
    const { container, rerender } = render(withTestLocalizer(<TextField label={LABEL} mask={MASK} name="account" />));
    const input = getInput(container);

    input.value = ACCOUNT;
    rerender(withTestLocalizer(<TextField isReadOnly label={LABEL} mask={MASK} name="account" />));

    expect(input.value).toBe(FORMATTED_ACCOUNT);
  });

  it('keeps the placeholder and the keyboard of the caller over those of the mask', () => {
    const { container } = render(
      withTestLocalizer(<TextField inputMode="text" label={LABEL} mask={MASK} name="account" placeholder={CUSTOM_PLACEHOLDER} />),
    );
    const input = getInput(container);

    expect(input.placeholder).toBe(CUSTOM_PLACEHOLDER);
    expect(input.inputMode).toBe('text');
  });
});
