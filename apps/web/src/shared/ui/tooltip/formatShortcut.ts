const KEY_SEPARATOR = '+';

const KEY_LABELS: Readonly<Record<string, string>> = {
  '-': '−',
  'Control': 'Ctrl',
  'Plus': '+',
};

const toKeyLabel = (key: string): string => {
  const label = Object.hasOwn(KEY_LABELS, key) ? KEY_LABELS[key] : undefined;

  return label ?? key;
};

export const formatShortcut = (shortcut: string): string[] => {
  return shortcut
    .split(KEY_SEPARATOR)
    .filter(key => key !== '')
    .map(toKeyLabel);
};
