import { countLineBreaks } from './source-lines.ts';

const templateQuote = '`';

interface SlashScanOptionsValue {
  hasLineCommentSyntax: boolean;
  hasTemplateLiterals: boolean;
}

const isQuoteCharacter = (character: string, hasTemplateLiterals: boolean): boolean =>
  character === '"' || character === '\'' || (hasTemplateLiterals && character === templateQuote);

const findSlashCommentLines = (source: string, options: SlashScanOptionsValue): number[] => {
  const commentLines: number[] = [];
  let lineNumber = 1;
  let openQuote: string | undefined;
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);

    if (character === '\n') {
      lineNumber += 1;
      if (openQuote !== templateQuote) {
        openQuote = undefined;
      }
    }
    else if (openQuote !== undefined) {
      if (character === '\\') {
        index += 1;
        if (source.charAt(index) === '\n') {
          lineNumber += 1;
        }
      }
      else if (character === openQuote) {
        openQuote = undefined;
      }
    }
    else if (isQuoteCharacter(character, options.hasTemplateLiterals)) {
      openQuote = character;
    }
    else if (source.startsWith('/*', index)) {
      commentLines.push(lineNumber);
      const blockEnd = source.indexOf('*/', index + 2);
      const blockBoundary = blockEnd === -1 ? source.length : blockEnd + 2;
      lineNumber += countLineBreaks(source.slice(index, blockBoundary));
      index = blockBoundary - 1;
    }
    else if (options.hasLineCommentSyntax && source.startsWith('//', index)) {
      commentLines.push(lineNumber);
      const lineEnd = source.indexOf('\n', index);
      index = lineEnd === -1 ? source.length : lineEnd - 1;
    }

    index += 1;
  }

  return commentLines;
};

export const findCssCommentLines = (source: string): number[] =>
  findSlashCommentLines(source, { hasLineCommentSyntax: false, hasTemplateLiterals: false });

export const findProtoCommentLines = (source: string): number[] =>
  findSlashCommentLines(source, { hasLineCommentSyntax: true, hasTemplateLiterals: false });

export const findScriptCommentLines = (source: string): number[] =>
  findSlashCommentLines(source, { hasLineCommentSyntax: true, hasTemplateLiterals: true });
