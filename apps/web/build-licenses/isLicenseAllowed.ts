const TOKEN_PATTERN = /[()]|[^\s()]+/g;

const OPERATOR_PATTERN = /^(?:AND|OR|WITH)$/i;

const AND_PATTERN = /^AND$/i;

const OR_PATTERN = /^OR$/i;

const WITH_PATTERN = /^WITH$/i;

const isIdentifier = (token: string | undefined): token is string =>
  token !== undefined && token !== '(' && token !== ')' && !OPERATOR_PATTERN.test(token);

export const isLicenseAllowed = (expression: string, allowedLicenses: readonly string[]): boolean => {
  const tokens = expression.match(TOKEN_PATTERN) ?? [];
  const allowed = new Set(allowedLicenses);
  let position = 0;

  const hasOperatorAhead = (pattern: RegExp): boolean => {
    const token = tokens[position];

    return token !== undefined && pattern.test(token);
  };

  const parseAtom = (): boolean | undefined => {
    const token = tokens[position];

    if (token === '(') {
      position += 1;

      const inner = parseOr();

      if (inner === undefined || tokens[position] !== ')') {
        return undefined;
      }

      position += 1;

      return inner;
    }

    if (!isIdentifier(token)) {
      return undefined;
    }

    position += 1;

    if (hasOperatorAhead(WITH_PATTERN)) {
      position += 1;

      if (!isIdentifier(tokens[position])) {
        return undefined;
      }

      position += 1;

      return false;
    }

    return allowed.has(token);
  };

  const parseAnd = (): boolean | undefined => {
    let result = parseAtom();

    while (result !== undefined && hasOperatorAhead(AND_PATTERN)) {
      position += 1;

      const operand = parseAtom();

      result = operand === undefined ? undefined : result && operand;
    }

    return result;
  };

  const parseOr = (): boolean | undefined => {
    let result = parseAnd();

    while (result !== undefined && hasOperatorAhead(OR_PATTERN)) {
      position += 1;

      const operand = parseAnd();

      result = operand === undefined ? undefined : result || operand;
    }

    return result;
  };

  const result = parseOr();

  return result === true && position === tokens.length;
};
