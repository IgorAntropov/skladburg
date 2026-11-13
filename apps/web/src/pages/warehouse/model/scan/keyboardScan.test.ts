import {
  expect,
  it,
} from 'vitest';

import type { ScannerKeyValue } from './keyboardScan';

import {
  createKeyboardScan,
  WAREHOUSE_SCANNER_PROFILE,
} from './keyboardScan';

const key = (value: string, code: string, timeStamp: number, modifiers: Partial<ScannerKeyValue> = {}): ScannerKeyValue => ({
  altKey: false, code, ctrlKey: false, isComposing: false, key: value, metaKey: false, repeat: false, shiftKey: false,
  timeStamp, ...modifiers,
});

it('reads a fast AIM and Russian-layout stream, including Ctrl+] and shifted punctuation', () => {
  const scan = createKeyboardScan(WAREHOUSE_SCANNER_PROFILE);
  scan.push(key('ъ', 'BracketRight', 0));
  scan.push(key('в', 'KeyD', 10));
  scan.push(key('2', 'Digit2', 20));
  scan.push(key('Ы', 'KeyS', 30, { shiftKey: true }));
  scan.push(key('.', 'Slash', 40, { shiftKey: true }));
  scan.push(key('ъ', 'BracketRight', 50, { ctrlKey: true }));
  scan.push(key('ф', '', 60));
  expect(scan.push(key('Enter', 'Enter', 70))).toBe(']d2S?\u001Da');
});

it('preserves numpad input, ASCII GS and the case delivered by a Latin keyboard', () => {
  const scan = createKeyboardScan({ ...WAREHOUSE_SCANNER_PROFILE, suffix: 'Tab' });
  scan.push(key('1', 'Numpad1', 0));
  scan.push(key('Z', 'KeyZ', 10));
  scan.push(key('\u001D', 'Unidentified', 20));
  scan.push(key('9', 'Digit9', 30));
  scan.push(key('2', 'Digit2', 40));
  expect(scan.push(key('Tab', 'Tab', 50))).toBe('1Z\u001D92');
});

it('does not complete a slow, stale, composed or interrupted sequence', () => {
  for (const interruption of [key('b', 'KeyB', 200), key('c', 'KeyC', 20, { ctrlKey: true }),
    key('a', 'KeyA', 20, { repeat: true }), key('Process', 'KeyB', 20, { isComposing: true }),
    key('Backspace', 'Backspace', 20)]) {
    const scan = createKeyboardScan(WAREHOUSE_SCANNER_PROFILE);
    scan.push(key('a', 'KeyA', 0));
    scan.push(key('2', 'Digit2', 10));
    scan.push(interruption);
    expect(scan.push(key('Enter', 'Enter', 210))).toBeUndefined();
  }
});

it('requires the configured prefix and resets after focus leaves', () => {
  const scan = createKeyboardScan({ ...WAREHOUSE_SCANNER_PROFILE, prefix: '!' });
  for (const symbol of 'ABCDE') {
    scan.push(key(symbol, '', 0));
  }
  expect(scan.push(key('Enter', 'Enter', 10))).toBeUndefined();
  scan.push(key('!', '', 20));
  for (const symbol of 'ABCDE') {
    scan.push(key(symbol, '', 30));
  }
  expect(scan.push(key('Enter', 'Enter', 40))).toBe('ABCDE');
  for (const symbol of '!ABCDE') {
    scan.push(key(symbol, '', 50));
  }
  scan.reset();
  expect(scan.push(key('Enter', 'Enter', 60))).toBeUndefined();
});
