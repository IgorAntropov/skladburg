import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createMoneyMask } from './createMoneyMask';
import { createQuantityMask } from './createQuantityMask';
import { createScaledNumberMask } from './createScaledNumberMask';

const mountedInputs: HTMLInputElement[] = [];

const createInput = (value = ''): HTMLInputElement => {
  const input = document.createElement('input');

  input.value = value;
  document.body.append(input);
  mountedInputs.push(input);

  return input;
};

const replaceRange = (input: HTMLInputElement, start: number, end: number, text: string, inputType: string): void => {
  const nextValue = input.value.slice(0, start) + text + input.value.slice(end);
  const caret = start + text.length;

  Reflect.set(HTMLInputElement.prototype, 'value', nextValue, input);
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType }));
};

const typeText = (input: HTMLInputElement, text: string): void => {
  for (const symbol of text) {
    const caret = input.selectionStart ?? input.value.length;

    replaceRange(input, caret, input.selectionEnd ?? caret, symbol, 'insertText');
  }
};

const pasteText = (input: HTMLInputElement, text: string): void => {
  const start = input.selectionStart ?? input.value.length;

  replaceRange(input, start, input.selectionEnd ?? start, text, 'insertFromPaste');
};

const deleteBackward = (input: HTMLInputElement): void => {
  const caret = input.selectionStart ?? input.value.length;

  if (caret > 0) {
    replaceRange(input, caret - 1, caret, '', 'deleteContentBackward');
  }
};

const placeCaret = (input: HTMLInputElement, position: number): void => {
  input.setSelectionRange(position, position);
};

const clearField = (input: HTMLInputElement): void => {
  replaceRange(input, 0, input.value.length, '', 'deleteContentBackward');
};

const leaveField = (input: HTMLInputElement): void => {
  input.dispatchEvent(new FocusEvent('blur'));
};

const createAttachedInput = (mask: ReturnType<typeof createMoneyMask>, value = ''): HTMLInputElement => {
  const input = createInput(value);

  mask.attach(input);

  return input;
};

describe('createScaledNumberMask', () => {
  afterEach(() => {
    for (const input of mountedInputs.splice(0)) {
      input.remove();
    }
  });

  describe('template and input mode', () => {
    it('shows the zero with the fraction digits and asks for the decimal keyboard', () => {
      const mask = createMoneyMask();

      expect(mask.template).toBe('0,00');
      expect(mask.inputMode).toBe('decimal');
    });

    it('shows the zero and asks for the numeric keyboard when there is no fraction', () => {
      const mask = createScaledNumberMask({ fractionDigits: 0, scale: 1n });

      expect(mask.template).toBe('0');
      expect(mask.inputMode).toBe('numeric');
    });
  });

  describe('unmask', () => {
    const { unmask } = createMoneyMask();

    it.each([
      ['89,50', '8950'],
      ['89.5', '8950'],
      ['1 234,5', '123450'],
      ['89', '8900'],
      ['89,', '8900'],
      ['0,07', '7'],
      ['007,10', '710'],
      [',', '0'],
      ['', ''],
      ['-', ''],
    ])('turns the shown %j into the stored %j', (shown, stored) => {
      expect(unmask(shown)).toBe(stored);
    });

    it('keeps the digits above the safe integer of a number exact', () => {
      expect(unmask('9 007 199 254 740 993,99')).toBe('900719925474099399');
    });

    it('cuts the fraction digits that are over the scale and the sign', () => {
      expect(unmask('-12,345')).toBe('1234');
    });
  });

  describe('attach', () => {
    it.each([
      ['8950', '89,50'],
      ['5', '0,05'],
      ['0', '0,00'],
      ['123456789', '1 234 567,89'],
      ['', ''],
    ])('shows the stored value %j as %j', (stored, shown) => {
      expect(createAttachedInput(createMoneyMask(), stored).value).toBe(shown);
    });

    it('shows the stored value of a field without a fraction with the groups only', () => {
      const input = createAttachedInput(createQuantityMask(1n), '480000');

      expect(input.value).toBe('480 000');
    });

    it('keeps a shown value that is attached again', () => {
      const mask = createMoneyMask();
      const input = createInput('8950');

      mask.attach(input)();
      mask.attach(input);

      expect(input.value).toBe('89,50');
    });

    it('stops formatting after the returned function is called', () => {
      const mask = createMoneyMask();
      const input = createInput();

      mask.attach(input)();
      typeText(input, '1234');

      expect(input.value).toBe('1234');
    });

    it('masks two fields of one mask apart from each other', () => {
      const mask = createMoneyMask();
      const first = createAttachedInput(mask);
      const second = createInput();

      mask.attach(second)();
      typeText(first, '1234');
      typeText(second, '1234');

      expect(first.value).toBe('1 234');
      expect(second.value).toBe('1234');
    });
  });

  describe('typing', () => {
    it('shows the groups and the comma while the value is typed', () => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, '1234567');

      expect(input.value).toBe('1 234 567');

      typeText(input, ',5');

      expect(input.value).toBe('1 234 567,5');
    });

    it.each([
      ['89,5', '89,5'],
      ['89.5', '89,5'],
      ['89,', '89,'],
      ['1,2,3', '1,23'],
      ['12,345', '12,34'],
    ])('shows the typed %j as %j', (typed, shown) => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, typed);

      expect(input.value).toBe(shown);
    });

    it('drops the minus, the letters and the spaces', () => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, '-1a 2b');

      expect(input.value).toBe('12');
    });

    it('drops the leading zeros and puts a zero before a comma typed first', () => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, '007');

      expect(input.value).toBe('7');

      clearField(input);
      typeText(input, ',5');

      expect(input.value).toBe('0,5');
    });

    it('drops the digits over the length that fits a 64-bit integer', () => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, '1'.repeat(25));

      expect(input.value).toBe('1 111 111 111 111 111');
    });

    it('leaves nothing when the field is cleared', () => {
      const input = createAttachedInput(createMoneyMask());
      typeText(input, '89,5');

      clearField(input);

      expect(input.value).toBe('');
    });

    it('shows a comma instead of a point on a field without a fraction as the end of the number', () => {
      const input = createAttachedInput(createQuantityMask(1n));

      pasteText(input, '12,5 pcs');

      expect(input.value).toBe('125');
    });
  });

  describe('paste', () => {
    it.each([
      ['8950', '8 950'],
      ['1 234,56', '1 234,56'],
      ['1234.56', '1 234,56'],
      ['1 234,56', '1 234,56'],
    ])('shows the pasted %j as %j', (pasted, shown) => {
      const input = createAttachedInput(createMoneyMask());

      pasteText(input, pasted);

      expect(input.value).toBe(shown);
    });

    it('replaces the selected part', () => {
      const input = createAttachedInput(createMoneyMask(), '123456');
      input.setSelectionRange(0, input.value.length);

      pasteText(input, '77,5');

      expect(input.value).toBe('77,5');
    });
  });

  describe('caret', () => {
    it('keeps the caret after the digit that was deleted in the middle', () => {
      const input = createAttachedInput(createMoneyMask());
      pasteText(input, '1234567');

      placeCaret(input, 3);
      deleteBackward(input);

      expect(input.value).toBe('134 567');
      expect(input.selectionStart).toBe(1);

      typeText(input, '2');

      expect(input.value).toBe('1 234 567');
      expect(input.selectionStart).toBe(3);
    });

    it('keeps the digits when a group space is deleted', () => {
      const input = createAttachedInput(createMoneyMask());
      pasteText(input, '1234567');

      placeCaret(input, 2);
      deleteBackward(input);

      expect(input.value).toBe('1 234 567');
    });

    it('puts the caret behind a comma that is typed into an empty field', () => {
      const input = createAttachedInput(createMoneyMask());

      typeText(input, ',');

      expect(input.value).toBe('0,');
      expect(input.selectionStart).toBe(2);
    });

    it('keeps the caret before the fraction digit that does not fit', () => {
      const input = createAttachedInput(createMoneyMask(), '8950');
      placeCaret(input, 3);

      typeText(input, '1');

      expect(input.value).toBe('89,15');
      expect(input.selectionStart).toBe(4);
    });

    it('puts the caret to the end when a digit is typed after the limit', () => {
      const input = createAttachedInput(createMoneyMask(), '8950');

      typeText(input, '1');

      expect(input.value).toBe('89,50');
      expect(input.selectionStart).toBe(5);
    });
  });

  describe('refresh', () => {
    it('shows the stored value that the program put into the field', () => {
      const mask = createMoneyMask();
      const input = createAttachedInput(mask);

      input.value = '8950';
      mask.refresh(input);

      expect(input.value).toBe('89,50');
    });

    it('clears the field when the program puts an empty value', () => {
      const mask = createMoneyMask();
      const input = createAttachedInput(mask);
      typeText(input, '89,5');

      input.value = '';
      mask.refresh(input);

      expect(input.value).toBe('');
    });

    it('leaves a typed value as it is', () => {
      const mask = createMoneyMask();
      const input = createAttachedInput(mask);
      typeText(input, '89');

      mask.refresh(input);

      expect(input.value).toBe('89');
    });

    it('takes the digits that equal the typed text for a stored value once the field was left', () => {
      const mask = createMoneyMask();
      const input = createAttachedInput(mask);
      typeText(input, '5');

      leaveField(input);

      expect(input.value).toBe('5,00');

      input.value = '5';
      mask.refresh(input);

      expect(input.value).toBe('0,05');
    });

    it('leaves a field that is not attached alone', () => {
      const input = createInput('8950');

      createMoneyMask().refresh(input);

      expect(input.value).toBe('8950');
    });
  });

  describe('leaving the field', () => {
    it.each([
      ['89', '89,00'],
      ['89,', '89,00'],
      ['89,5', '89,50'],
      ['', ''],
    ])('completes the typed %j to %j', (typed, completed) => {
      const input = createAttachedInput(createMoneyMask());
      typeText(input, typed);

      leaveField(input);

      expect(input.value).toBe(completed);
    });

    it('shows a stored value that was not refreshed yet as a stored value', () => {
      const input = createAttachedInput(createMoneyMask());

      input.value = '8950';
      leaveField(input);

      expect(input.value).toBe('89,50');
    });
  });

  describe('quantity', () => {
    it.each([
      [1000n, '0,000', '480000', '480,000', '480000'],
      [1000000n, '0,000000', '480000000', '480,000000', '480000000'],
      [1n, '0', '480', '480', '480'],
      [10n, '0,0', '4805', '480,5', '4805'],
      [500n, '0', '480', '480', '480'],
      [1500n, '0', '480', '480', '480'],
    ])('with the base %s shows %j: stored %j as %j', (base, template, stored, shown, unmasked) => {
      const mask = createQuantityMask(base);
      const input = createAttachedInput(mask, stored);

      expect(mask.template).toBe(template);
      expect(input.value).toBe(shown);
      expect(mask.unmask(shown)).toBe(unmasked);
    });

    it('takes kilograms in grams: a point, a comma and the third digit of the fraction', () => {
      const mask = createQuantityMask(1000n);
      const input = createAttachedInput(mask);

      typeText(input, '1.2345');

      expect(input.value).toBe('1,234');
      expect(mask.unmask(input.value)).toBe('1234');
    });

    it('takes tons in grams', () => {
      const mask = createQuantityMask(1000000n);
      const input = createAttachedInput(mask);

      typeText(input, '0,000001');

      expect(mask.unmask(input.value)).toBe('1');
    });

    it('asks for the numeric keyboard when the unit has no fraction', () => {
      expect(createQuantityMask(1n).inputMode).toBe('numeric');
      expect(createQuantityMask(1000n).inputMode).toBe('decimal');
    });
  });
});
