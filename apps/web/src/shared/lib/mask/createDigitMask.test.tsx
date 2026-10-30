import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createDigitMask } from './createDigitMask';

const ACCOUNT_PATTERN = '##### ### # #### #######';
const ACCOUNT = '40702810000000000001';
const FORMATTED_ACCOUNT = '40702 810 0 0000 0000001';

const mountedInputs: HTMLInputElement[] = [];

const createInput = (value = ''): HTMLInputElement => {
  const input = document.createElement('input');

  input.value = value;
  document.body.append(input);
  mountedInputs.push(input);

  return input;
};

const typeInto = (input: HTMLInputElement, value: string): void => {
  Reflect.set(HTMLInputElement.prototype, 'value', value, input);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
};

describe('createDigitMask', () => {
  afterEach(() => {
    for (const input of mountedInputs.splice(0)) {
      input.remove();
    }
  });

  describe('unmask', () => {
    it('keeps the digits only and cuts them to the length of the pattern', () => {
      const { unmask } = createDigitMask(ACCOUNT_PATTERN);

      expect(unmask(FORMATTED_ACCOUNT)).toBe(ACCOUNT);
      expect(unmask(ACCOUNT)).toBe(ACCOUNT);
      expect(unmask('40702-810 abc 0')).toBe('407028100');
      expect(unmask(`${ACCOUNT}999`)).toBe(ACCOUNT);
      expect(unmask('')).toBe('');
    });
  });

  describe('template and input mode', () => {
    it('shows zeros in place of the digits when no template is given', () => {
      expect(createDigitMask('#########').template).toBe('000000000');
    });

    it('takes the template that was given and asks for the numeric keyboard', () => {
      const mask = createDigitMask(ACCOUNT_PATTERN, '00000 000 0 0000 0000000');

      expect(mask.template).toBe('00000 000 0 0000 0000000');
      expect(mask.inputMode).toBe('numeric');
    });
  });

  describe('attach', () => {
    it('formats the value that the field already has', () => {
      const input = createInput(ACCOUNT);

      createDigitMask(ACCOUNT_PATTERN).attach(input);

      expect(input.value).toBe(FORMATTED_ACCOUNT);
    });

    it('formats what is typed after it and drops what does not fit', () => {
      const input = createInput();
      createDigitMask(ACCOUNT_PATTERN).attach(input);

      typeInto(input, '40702abc810');

      expect(input.value).toBe('40702 810');

      typeInto(input, `${ACCOUNT}555`);

      expect(input.value).toBe(FORMATTED_ACCOUNT);
    });

    it('stops formatting after the returned function is called', () => {
      const input = createInput();
      const detach = createDigitMask(ACCOUNT_PATTERN).attach(input);

      detach();
      typeInto(input, '40702810');

      expect(input.value).toBe('40702810');
    });

    it('masks two fields of one mask apart from each other', () => {
      const first = createInput();
      const second = createInput();
      const mask = createDigitMask(ACCOUNT_PATTERN);
      mask.attach(first);
      const detachSecond = mask.attach(second);

      detachSecond();
      typeInto(first, '40702810');
      typeInto(second, '40702810');

      expect(first.value).toBe('40702 810');
      expect(second.value).toBe('40702810');
    });
  });

  describe('refresh', () => {
    it('formats a value that the program put into the field', () => {
      const input = createInput();
      const mask = createDigitMask(ACCOUNT_PATTERN);
      mask.attach(input);

      input.value = ACCOUNT;
      mask.refresh(input);

      expect(input.value).toBe(FORMATTED_ACCOUNT);
    });

    it('leaves a field that is not attached alone', () => {
      const input = createInput(ACCOUNT);

      createDigitMask(ACCOUNT_PATTERN).refresh(input);

      expect(input.value).toBe(ACCOUNT);
    });
  });
});
