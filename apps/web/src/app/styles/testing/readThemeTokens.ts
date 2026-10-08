export type ThemeNameValue = 'dark' | 'light';

export interface ThemeTokensValue {
  darkOverrideNames: readonly string[];
  tokens: Readonly<Record<ThemeNameValue, ReadonlyMap<string, string>>>;
}

const LIGHT_BLOCK_HEADERS = [
  /^@theme\s+static\s*\{/m,
  /^@theme\s+inline\s*\{/m,
];

const DARK_BLOCK_HEADER = /^\[data-theme='dark'\]\s*\{/m;

const DECLARATION_PATTERN = /^(--[\w-]+)\s*:\s*([\s\S]+)$/;

const readBlockBody = (css: string, header: RegExp): string => {
  const match = header.exec(css);

  if (match === null) {
    throw new Error(`Theme block ${header.source} is missing in theme.css`);
  }

  const bodyStart = match.index + match[0].length;
  let depth = 1;

  for (let index = bodyStart; index < css.length; index += 1) {
    const character = css.charAt(index);

    if (character === '{') {
      depth += 1;
    }

    if (character === '}') {
      depth -= 1;
    }

    if (depth === 0) {
      return css.slice(bodyStart, index);
    }
  }

  throw new Error(`Theme block ${header.source} is not closed in theme.css`);
};

const readDeclarations = (body: string): Map<string, string> => {
  const declarations = new Map<string, string>();

  for (const rawDeclaration of body.split(';')) {
    const match = DECLARATION_PATTERN.exec(rawDeclaration.trim());

    if (match?.[1] !== undefined && match[2] !== undefined) {
      declarations.set(match[1], match[2].replaceAll(/\s+/g, ' ').trim());
    }
  }

  return declarations;
};

export const readThemeTokens = (css: string): ThemeTokensValue => {
  const light = new Map<string, string>();

  for (const header of LIGHT_BLOCK_HEADERS) {
    for (const [name, value] of readDeclarations(readBlockBody(css, header))) {
      light.set(name, value);
    }
  }

  const darkOverrides = readDeclarations(readBlockBody(css, DARK_BLOCK_HEADER));
  const dark = new Map<string, string>([...light, ...darkOverrides]);

  return {
    darkOverrideNames: [...darkOverrides.keys()],
    tokens: { dark, light },
  };
};
