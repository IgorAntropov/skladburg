import { MaskInput } from 'maska';

import type { InputMaskValue } from './inputMaskTypes';

const DIGIT_TOKEN = '#';

const NON_DIGITS_PATTERN = /\D/gu;

export const createDigitMask = (pattern: string, template?: string): InputMaskValue => {
  const digitCount = pattern.split(DIGIT_TOKEN).length - 1;
  const maskInputs = new Map<HTMLInputElement, MaskInput>();

  const attach = (input: HTMLInputElement): (() => void) => {
    const maskInput = new MaskInput(input, { mask: pattern });

    maskInputs.set(input, maskInput);
    maskInput.updateValue(input);

    return (): void => {
      maskInput.destroy();
      maskInputs.delete(input);
    };
  };

  const refresh = (input: HTMLInputElement): void => {
    maskInputs.get(input)?.updateValue(input);
  };

  const unmask = (value: string): string => value.replace(NON_DIGITS_PATTERN, '').slice(0, digitCount);

  return {
    attach,
    inputMode: 'numeric',
    refresh,
    template: template ?? pattern.replaceAll(DIGIT_TOKEN, '0'),
    unmask,
  };
};
