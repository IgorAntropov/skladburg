import type { Rule } from 'eslint';

type AstNodeValue = Readonly<Record<string, unknown>>;

const defaultAttributes: readonly string[] = [
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'label',
  'placeholder',
  'title',
];

const letterPattern = /\p{L}/u;

const toAstNode = (value: unknown): AstNodeValue | undefined => {
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return value;
  }

  return undefined;
};

const toStringList = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items: unknown[] = value;

  return items.every(item => typeof item === 'string') ? items.filter(item => typeof item === 'string') : undefined;
};

const readAttributes = (options: readonly unknown[]): readonly string[] => {
  const [firstOption] = options;
  const optionNode = typeof firstOption === 'object' && firstOption !== null ? firstOption : undefined;
  const configuredAttributes = optionNode && 'attributes' in optionNode ? toStringList(optionNode.attributes) : undefined;

  return configuredAttributes ?? defaultAttributes;
};

const readCookedText = (quasi: unknown): string => {
  const value = toAstNode(quasi)?.value;

  if (typeof value !== 'object' || value === null || !('cooked' in value)) {
    return '';
  }

  return typeof value.cooked === 'string' ? value.cooked : '';
};

const readStaticText = (node: AstNodeValue): string | undefined => {
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : undefined;
  }

  if (node.type !== 'TemplateLiteral' || !Array.isArray(node.quasis)) {
    return undefined;
  }

  const quasis: unknown[] = node.quasis;

  return quasis.map(readCookedText).join('');
};

const readAttributeName = (attribute: AstNodeValue): string | undefined => {
  const name = toAstNode(attribute.name);

  return name?.type === 'JSXIdentifier' && typeof name.name === 'string' ? name.name : undefined;
};

const isTransparentParent = (parent: AstNodeValue, current: AstNodeValue): boolean => {
  if (parent.type === 'ConditionalExpression') {
    return parent.test !== current;
  }

  return parent.type === 'LogicalExpression' && parent.right === current;
};

const findHost = (start: AstNodeValue): AstNodeValue | undefined => {
  let current = start;
  let parent = toAstNode(current.parent);

  while (parent && isTransparentParent(parent, current)) {
    current = parent;
    parent = toAstNode(current.parent);
  }

  return parent;
};

const isUiPosition = (node: AstNodeValue, attributes: readonly string[]): boolean => {
  const host = findHost(node);

  if (host?.type === 'JSXAttribute') {
    return attributes.includes(readAttributeName(host) ?? '');
  }

  if (host?.type !== 'JSXExpressionContainer') {
    return false;
  }

  const owner = toAstNode(host.parent);

  if (owner?.type === 'JSXAttribute') {
    return attributes.includes(readAttributeName(owner) ?? '');
  }

  return owner?.type === 'JSXElement' || owner?.type === 'JSXFragment';
};

export const noUiStringsRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => {
    const attributes = readAttributes(context.options);

    const checkStaticText = (node: Rule.Node): void => {
      const astNode = toAstNode(node);
      const text = astNode ? readStaticText(astNode) : undefined;

      if (astNode && text !== undefined && letterPattern.test(text) && isUiPosition(astNode, attributes)) {
        context.report({ messageId: 'uiStringInJsx', node });
      }
    };

    const checkJsxText = (node: Rule.Node): void => {
      const astNode = toAstNode(node);

      if (typeof astNode?.value === 'string' && letterPattern.test(astNode.value)) {
        context.report({ messageId: 'uiStringInJsx', node });
      }
    };

    return {
      JSXText: checkJsxText,
      Literal: checkStaticText,
      TemplateLiteral: checkStaticText,
    };
  },
  meta: {
    messages: {
      uiStringInJsx: 'UI text must come from a locale catalog',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          attributes: {
            items: { type: 'string' },
            type: 'array',
            uniqueItems: true,
          },
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },
};
