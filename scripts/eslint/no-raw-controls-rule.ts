import type { Rule } from 'eslint';

const rawControlNames: readonly string[] = ['button', 'input', 'select', 'textarea'];

const rawControlSelector = `JSXOpeningElement > JSXIdentifier.name:matches(${rawControlNames.map(name => `[name='${name}']`).join(', ')})`;

export const noRawControlsRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => ({
    [rawControlSelector]: (node: Rule.Node): void => {
      context.report({ data: { name: context.sourceCode.getText(node) }, messageId: 'rawControl', node });
    },
  }),
  meta: {
    messages: {
      rawControl: 'Raw <{{name}}> belongs to shared/ui; use Button, DropdownMenu or another primitive from @/shared/ui',
    },
    schema: [],
    type: 'problem',
  },
};
