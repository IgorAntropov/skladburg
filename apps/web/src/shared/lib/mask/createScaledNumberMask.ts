import type { InputMaskValue } from './inputMaskTypes';

import {
  completeNumberParts,
  countNumberSigns,
  findCaretAfterSigns,
  formatNumberParts,
  parseStoredNumber,
  parseTypedNumber,
} from './scaledNumberParts';

export interface ScaledNumberMaskOptionsValue {
  fractionDigits: number;
  scale: bigint;
}

const STORED_TEXT_PATTERN = /^\d*$/u;

export const createScaledNumberMask = ({ fractionDigits, scale }: ScaledNumberMaskOptionsValue): InputMaskValue => {
  const shownTexts = new Map<HTMLInputElement, string>();

  const toCompleteText = (text: string): string => {
    const parts = STORED_TEXT_PATTERN.test(text) ? parseStoredNumber(text, fractionDigits) : parseTypedNumber(text, fractionDigits);

    return formatNumberParts(completeNumberParts(parts, fractionDigits));
  };

  const show = (input: HTMLInputElement, text: string): void => {
    input.value = text;
    shownTexts.set(input, text);
  };

  const refresh = (input: HTMLInputElement): void => {
    const shownText = shownTexts.get(input);

    if (shownText !== undefined && input.value !== shownText) {
      show(input, toCompleteText(input.value));
    }
  };

  const handleInput = (event: Event): void => {
    const input = event.currentTarget;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const { value } = input;
    const text = formatNumberParts(parseTypedNumber(value, fractionDigits));

    if (text !== value) {
      const caret = input.selectionStart ?? value.length;
      const signCount = countNumberSigns(parseTypedNumber(value.slice(0, caret), fractionDigits));
      const nextCaret = findCaretAfterSigns(text, signCount);

      input.value = text;
      input.setSelectionRange(nextCaret, nextCaret);
    }

    shownTexts.set(input, text);
  };

  const handleBlur = (event: Event): void => {
    const input = event.currentTarget;

    if (input instanceof HTMLInputElement) {
      refresh(input);
      show(input, formatNumberParts(completeNumberParts(parseTypedNumber(input.value, fractionDigits), fractionDigits)));
    }
  };

  const attach = (input: HTMLInputElement): (() => void) => {
    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleBlur);
    show(input, toCompleteText(input.value));

    return (): void => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleBlur);
      shownTexts.delete(input);
    };
  };

  const unmask = (value: string): string => {
    const { fraction, whole } = parseTypedNumber(value, fractionDigits);

    return whole === '' ? '' : (BigInt(whole) * scale + BigInt(fraction.padEnd(fractionDigits, '0') || '0')).toString();
  };

  return {
    attach,
    inputMode: fractionDigits > 0 ? 'decimal' : 'numeric',
    refresh,
    template: fractionDigits > 0 ? `0,${'0'.repeat(fractionDigits)}` : '0',
    unmask,
  };
};
