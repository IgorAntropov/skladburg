import { GROUP_SEPARATOR } from './parseWarehouseScan';

export interface ScannerKeyValue {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
  repeat: boolean;
  shiftKey: boolean;
  timeStamp: number;
}

interface IKeyboardScan {
  isGroupSeparator: (event: ScannerKeyValue) => boolean;
  push: (event: ScannerKeyValue, canStart?: boolean) => string | undefined;
  reset: () => void;
}

interface ScannerProfileValue {
  groupSeparatorKey: string;
  maxGapMs: number;
  prefix: string;
  suffix: string;
}

export const WAREHOUSE_SCANNER_PROFILE = {
  groupSeparatorKey: 'BracketRight',
  maxGapMs: 50,
  prefix: '',
  suffix: 'Enter',
} satisfies ScannerProfileValue;

const CYRILLIC = /[а-яё]/iu;
const RUSSIAN = 'ёйцукенгшщзхъфывапролджэячсмитьбю';
const LATIN = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
const SHIFTED = '~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>';
const PUNCTUATION: Readonly<Record<string, string>> = {
  Backquote: '`~', Backslash: '\\|', BracketLeft: '[{', BracketRight: ']}', Comma: ',<', Equal: '=+',
  Minus: '-_', Period: '.>', Quote: '\'"', Semicolon: ';:', Slash: '/?',
};

const readKey = ({ code, key, shiftKey }: ScannerKeyValue, isRussian: boolean): string => {
  if (!isRussian) {
    return key;
  }
  if (/^Key[A-Z]$/u.test(code)) {
    return key === key.toLowerCase() ? code.slice(3).toLowerCase() : code.slice(3);
  }
  if (/^Digit\d$/u.test(code)) {
    const digit = code.slice(5);
    return shiftKey ? ')!@#$%^&*('.charAt(Number(digit)) : digit;
  }
  const punctuation = PUNCTUATION[code];
  if (punctuation !== undefined) {
    return punctuation.charAt(shiftKey ? 1 : 0);
  }
  const index = RUSSIAN.indexOf(key.toLowerCase());
  return index === -1 ? key : (key === key.toLowerCase() ? LATIN : SHIFTED).charAt(index);
};

export const createKeyboardScan = (profile: ScannerProfileValue): IKeyboardScan => {
  let keys: (ScannerKeyValue | typeof GROUP_SEPARATOR)[] = [];
  let lastAt = 0;
  const reset = (): void => {
    keys = [];
  };
  const isGroupSeparator = (event: ScannerKeyValue): boolean => event.key === GROUP_SEPARATOR
    || (event.ctrlKey && !event.altKey && !event.metaKey && (event.code === profile.groupSeparatorKey || event.key === ']'));

  const push = (event: ScannerKeyValue, canStart = true): string | undefined => {
    if (event.key === 'Shift' || event.key === 'Control') {
      return undefined;
    }
    if (event.isComposing || event.repeat || event.altKey || event.metaKey || (event.ctrlKey && !isGroupSeparator(event))) {
      reset();
      return undefined;
    }
    if (event.timeStamp - lastAt > profile.maxGapMs) {
      reset();
    }
    lastAt = event.timeStamp;
    if (event.key === profile.suffix) {
      const isRussian = keys.some(key => typeof key !== 'string' && CYRILLIC.test(key.key));
      const raw = keys.map(key => typeof key === 'string' ? key : readKey(key, isRussian)).join('');
      reset();
      return raw.length >= profile.prefix.length + 4 && raw.startsWith(profile.prefix) ? raw.slice(profile.prefix.length) : undefined;
    }
    if (keys.length >= 256 || (event.key.length !== 1 && !isGroupSeparator(event))) {
      reset();
      return undefined;
    }
    if (keys.length > 0 || canStart) {
      keys.push(isGroupSeparator(event) ? GROUP_SEPARATOR : event);
    }
    return undefined;
  };

  return { isGroupSeparator, push, reset };
};
