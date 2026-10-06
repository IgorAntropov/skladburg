import type { Rule } from 'eslint';

type SpecifierHostNode
  = | Parameters<NonNullable<Rule.RuleListener['ExportNamedDeclaration']>>[0]
    | Parameters<NonNullable<Rule.RuleListener['ImportDeclaration']>>[0];

export const specifierNewlineRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => {
    const checkSpecifiers = (node: SpecifierHostNode): void => {
      const namedSpecifiers = node.specifiers.filter(
        specifier => specifier.type === 'ImportSpecifier' || specifier.type === 'ExportSpecifier',
      );

      namedSpecifiers.forEach((specifier, index) => {
        const previous = namedSpecifiers[index - 1];

        if (!previous || previous.loc?.end.line !== specifier.loc?.start.line) {
          return;
        }

        const comma = context.sourceCode.getTokenAfter(previous);

        context.report({
          fix: (fixer: Rule.RuleFixer): null | Rule.Fix => {
            if (comma?.value !== ',' || context.sourceCode.commentsExistBetween(comma, specifier)) {
              return null;
            }

            return fixer.replaceTextRange([comma.range[1], specifier.range?.[0] ?? comma.range[1]], '\n');
          },
          messageId: 'specifierOnNewLine',
          node: specifier,
        });
      });
    };

    return {
      ExportNamedDeclaration: checkSpecifiers,
      ImportDeclaration: checkSpecifiers,
    };
  },
  meta: {
    fixable: 'whitespace',
    messages: {
      specifierOnNewLine: 'Each named specifier must be on its own line',
    },
    schema: [],
    type: 'layout',
  },
};
