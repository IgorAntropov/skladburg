import { hasGs1CheckDigit } from '@skladburg/contracts/gs1';

export type WarehouseScanParserValue = (raw: string) => undefined | WarehouseScanValue;

export type WarehouseScanValue
  = | ProductScanValue
    | { code: string; kind: 'local' }
    | { kind: 'unit'; sscc: string };

interface ProductScanValue {
  batch?: string | undefined;
  cryptoTail?: string | undefined;
  expiry?: string | undefined;
  gtin: string;
  kind: 'product';
  serial?: string | undefined;
}

export const GROUP_SEPARATOR = '\u001D';

export const AIM_PREFIX = /^\](?:C[01]|d[12]|E[04]|Q[13])/u;
const FIXED_LENGTHS: Readonly<Record<string, number>> = { '00': 18, '01': 14, '17': 6 };
const VARIABLE_LENGTHS: Readonly<Record<string, number>> = { 10: 20, 21: 20, 91: 90, 92: 90, 93: 90 };
const GS1_DATA = /^[!"%&'()*+,./\d:;<=>?A-Z_a-z-]+$/u;
const LOCAL_CODE = /^[A-Z\d][\w.-]{0,127}$/iu;

const isExpiryValid = (value: string): boolean => {
  if (!/^\d{6}$/u.test(value)) {
    return false;
  }
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return month >= 1 && month <= 12 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const normalizeHumanReadable = (raw: string): string | undefined => {
  const parts = raw.split(/\((\d{2,4})\)/u);
  const normalized: string[] = [];
  if (parts[0] !== '') {
    return undefined;
  }
  for (let index = 1; index < parts.length; index += 2) {
    const ai = parts[index] ?? '';
    const value = parts[index + 1] ?? '';
    const fixedLength = FIXED_LENGTHS[ai];
    if (fixedLength !== undefined && value.length !== fixedLength) {
      return undefined;
    }
    if (value.includes(GROUP_SEPARATOR)) {
      return undefined;
    }
    normalized.push(ai + value + (Object.hasOwn(VARIABLE_LENGTHS, ai) ? GROUP_SEPARATOR : ''));
  }
  return normalized.join('');
};

const readElements = (raw: string): ReadonlyMap<string, string> | undefined => {
  const values = new Map<string, string>();
  let rest = raw;
  while (rest !== '') {
    const ai = rest.slice(0, 2);
    const fixedLength = FIXED_LENGTHS[ai];
    const limit = fixedLength ?? VARIABLE_LENGTHS[ai];
    if (limit === undefined || values.has(ai)) {
      return undefined;
    }
    const data = rest.slice(2);
    const separatorIndex = data.indexOf(GROUP_SEPARATOR);
    const length = fixedLength ?? (separatorIndex === -1 ? data.length : separatorIndex);
    const value = data.slice(0, length);
    if (value.length !== length || length > limit || !(fixedLength === undefined ? GS1_DATA : /^\d+$/u).test(value)) {
      return undefined;
    }
    values.set(ai, value);
    rest = data.slice(length);
    if (rest.startsWith(GROUP_SEPARATOR)) {
      rest = rest.slice(1);
    }
  }
  return values;
};

const parseGs1 = (raw: string): undefined | WarehouseScanValue => {
  const normalized = raw.startsWith('(') ? normalizeHumanReadable(raw) : raw;
  const elements = normalized === undefined ? undefined : readElements(normalized);
  const sscc = elements?.get('00');
  if (sscc !== undefined) {
    return elements?.size === 1 && hasGs1CheckDigit(sscc) ? { kind: 'unit', sscc } : undefined;
  }

  const gtin = elements?.get('01');
  const expiry = elements?.get('17');
  const serial = elements?.get('21');
  const cryptoTail = [...elements ?? []]
    .filter(([ai]) => ai === '91' || ai === '92' || ai === '93')
    .map(([ai, value]) => ai + value)
    .join(GROUP_SEPARATOR);
  if (gtin === undefined || !hasGs1CheckDigit(gtin) || (expiry !== undefined && !isExpiryValid(expiry))
    || (cryptoTail !== '' && serial === undefined)) {
    return undefined;
  }
  return { batch: elements?.get('10'), cryptoTail: cryptoTail || undefined, expiry, gtin, kind: 'product', serial };
};

export const parseWarehouseScan = (input: string): undefined | WarehouseScanValue => {
  const trimmed = input.trim();
  const aim = AIM_PREFIX.exec(trimmed)?.[0];
  const payload = trimmed.slice(aim?.length ?? 0);
  const raw = payload.startsWith(GROUP_SEPARATOR) ? payload.slice(1) : payload;
  if (raw.length > 256) {
    return undefined;
  }
  const isGs1 = aim === ']C1' || aim === ']d2' || aim === ']Q3' || raw.startsWith('(') || raw.includes(GROUP_SEPARATOR);
  if (!isGs1 && /^\d{18}$/u.test(raw)) {
    return hasGs1CheckDigit(raw) ? { kind: 'unit', sscc: raw } : undefined;
  }
  if (!isGs1 && /^(?:\d{8}|\d{12,14})$/u.test(raw)) {
    return hasGs1CheckDigit(raw) ? { gtin: raw, kind: 'product' } : undefined;
  }
  if (isGs1 || /^(?:00\d{18}|01\d{14})/u.test(raw)) {
    return parseGs1(raw);
  }
  return LOCAL_CODE.test(raw) ? { code: raw, kind: 'local' } : undefined;
};
