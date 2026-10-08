import {
  describe,
  expect,
  it,
} from 'vitest';

import { readThemeTokens } from './readThemeTokens';

const SAMPLE_CSS = `
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

@theme static {
  --color-*: initial;
  --color-canvas: #edeae3;
  --color-panel: rgb(255 255 255 / 0.92);
  --shadow-panel:
    0 10px 30px -12px rgb(30 42 74 / 0.28), 0 1px 2px rgb(30 42 74 / 0.12);
}

@theme inline {
  --color-status-ok: #2fa36b;
}

:root {
  color-scheme: light;
}

[data-theme='dark'] {
  color-scheme: dark;
  --color-canvas: #121a30;
}

@media (prefers-reduced-transparency: reduce) {
  :root,
  [data-theme='dark'] {
    --color-panel: var(--color-panel-solid);
  }
}
`;

describe('readThemeTokens', () => {
  it('merges static and inline theme blocks into the light theme', () => {
    const { tokens } = readThemeTokens(SAMPLE_CSS);

    expect(tokens.light.get('--color-canvas')).toBe('#edeae3');
    expect(tokens.light.get('--color-status-ok')).toBe('#2fa36b');
  });

  it('applies dark overrides on top of the light theme', () => {
    const { tokens } = readThemeTokens(SAMPLE_CSS);

    expect(tokens.dark.get('--color-canvas')).toBe('#121a30');
    expect(tokens.dark.get('--color-status-ok')).toBe('#2fa36b');
    expect(tokens.dark.get('--color-panel')).toBe('rgb(255 255 255 / 0.92)');
  });

  it('lists only tokens overridden in the dark block', () => {
    const { darkOverrideNames } = readThemeTokens(SAMPLE_CSS);

    expect(darkOverrideNames).toEqual(['--color-canvas']);
  });

  it('keeps multiline values on one line', () => {
    const { tokens } = readThemeTokens(SAMPLE_CSS);

    expect(tokens.light.get('--shadow-panel')).toBe(
      '0 10px 30px -12px rgb(30 42 74 / 0.28), 0 1px 2px rgb(30 42 74 / 0.12)',
    );
  });

  it('ignores wildcard resets and blocks that only use var()', () => {
    const { tokens } = readThemeTokens(SAMPLE_CSS);

    expect(tokens.light.has('--color-*')).toBe(false);
    expect(tokens.light.get('--color-panel')).toBe('rgb(255 255 255 / 0.92)');
  });

  it('throws when the dark block is missing', () => {
    const cssWithoutDark = '@theme static {\n  --color-canvas: #ffffff;\n}\n@theme inline {\n  --color-x: #000000;\n}';

    expect(() => readThemeTokens(cssWithoutDark)).toThrow('is missing');
  });

  it('throws when a block is not closed', () => {
    expect(() => readThemeTokens('@theme static {\n  --color-canvas: #ffffff;\n')).toThrow('is not closed');
  });
});
