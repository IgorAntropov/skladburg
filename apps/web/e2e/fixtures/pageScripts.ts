export const READ_HORIZONTAL_OVERFLOW = '(() => document.documentElement.scrollWidth - window.innerWidth)()';

export const createReadTokenColorScript = (tokenName: string): string => [
  '(() => {',
  'const probe = document.createElement("div");',
  `probe.style.backgroundColor = "var(${tokenName})";`,
  'document.documentElement.append(probe);',
  'const color = getComputedStyle(probe).backgroundColor;',
  'probe.remove();',
  'return color;',
  '})()',
].join(' ');

export const DISPATCH_RUSSIAN_LAYOUT_SLASH = [
  '(() => {',
  'document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "Slash", key: "." }));',
  '})()',
].join(' ');

export const BLUR_ACTIVE_ELEMENT = [
  '(() => {',
  'const active = document.activeElement;',
  'if (active instanceof HTMLElement) { active.blur(); }',
  '})()',
].join(' ');

export const READ_IS_FOCUS_ON_BODY = '(() => document.activeElement === document.body || document.activeElement === null)()';
