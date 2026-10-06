import type { Rule } from 'eslint';

export const noCommentsRule: Rule.RuleModule = {
  create: (context: Rule.RuleContext): Rule.RuleListener => ({
    Program: (): void => {
      for (const comment of context.sourceCode.getAllComments()) {
        if (comment.loc) {
          context.report({ loc: comment.loc, messageId: 'commentForbidden' });
        }
      }
    },
  }),
  meta: {
    messages: {
      commentForbidden: 'Comments are forbidden',
    },
    schema: [],
    type: 'problem',
  },
};
