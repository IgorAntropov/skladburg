import type { MessageFormRulesValue } from './readFormRules.ts';

const INDENT = '  ';
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const renderKey = (key: string): string => (IDENTIFIER_PATTERN.test(key) ? key : JSON.stringify(key));

const compareKeys = (current: string, next: string): number => {
  if (current === next) {
    return 0;
  }

  return current < next ? -1 : 1;
};

const isPrimitive = (value: unknown): boolean =>
  typeof value === 'bigint' || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';

const renderValue = (value: unknown, depth: number): string => {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const innerIndent = INDENT.repeat(depth + 1);
  const outerIndent = INDENT.repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (value.every(isPrimitive)) {
      return `[${value.map(item => renderValue(item, depth + 1)).join(', ')}]`;
    }

    const items = value.map(item => `${innerIndent}${renderValue(item, depth + 1)},`);

    return `[\n${items.join('\n')}\n${outerIndent}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .toSorted(([current], [next]) => compareKeys(current, next));

    if (entries.length === 0) {
      return '{}';
    }

    const lines = entries.map(([key, entry]) => `${innerIndent}${renderKey(key)}: ${renderValue(entry, depth + 1)},`);

    return `{\n${lines.join('\n')}\n${outerIndent}}`;
  }

  throw new Error(`Cannot render a ${typeof value} value in a form rules table`);
};

export const renderFormRulesLiteral = (value: unknown): string => renderValue(value, 0);

export const renderFormRulesModule = (
  messages: readonly MessageFormRulesValue[],
  formsImportPath: string,
): string => {
  const exports = messages.map(message =>
    `export const ${message.exportName} = ${renderFormRulesLiteral(message.rules)} as const satisfies FormRulesValue;\n`);

  return `import type { FormRulesValue } from ${JSON.stringify(formsImportPath)};\n\n${exports.join('\n')}`;
};
