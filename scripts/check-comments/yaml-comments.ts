import { splitLines } from './source-lines.ts';

const whitespacePattern = /\s/;
const yamlQuoteOpeningPredecessors = ':-,[{?';
const blockScalarIndicatorPattern = /(^|[:?-]\s+)\s*[|>](?:[+-][1-9]?|[1-9][+-]?)?$/;
const sequencePrefixPattern = /^\s*(?:-\s+)*/;

const getIndent = (line: string): number => line.length - line.trimStart().length;

const canOpenYamlQuote = (line: string, quoteIndex: number): boolean => {
  const precedingText = line.slice(0, quoteIndex).trimEnd();

  return precedingText === '' || yamlQuoteOpeningPredecessors.includes(precedingText.charAt(precedingText.length - 1));
};

const findYamlCommentColumn = (line: string): number | undefined => {
  let openQuote: string | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const character = line.charAt(index);

    if (openQuote !== undefined) {
      if (openQuote === '"' && character === '\\') {
        index += 1;
      }
      else if (openQuote === '\'' && character === '\'' && line.charAt(index + 1) === '\'') {
        index += 1;
      }
      else if (character === openQuote) {
        openQuote = undefined;
      }
    }
    else if (character === '#' && (index === 0 || whitespacePattern.test(line.charAt(index - 1)))) {
      return index;
    }
    else if ((character === '"' || character === '\'') && canOpenYamlQuote(line, index)) {
      openQuote = character;
    }
  }

  return undefined;
};

const findBlockScalarParentIndent = (codeText: string): number | undefined => {
  const trimmedCode = codeText.trimEnd();
  const indicatorMatch = blockScalarIndicatorPattern.exec(trimmedCode);

  if (indicatorMatch === null) {
    return undefined;
  }

  const lead = indicatorMatch[1] ?? '';

  if (lead.startsWith(':')) {
    return sequencePrefixPattern.exec(trimmedCode)?.[0].length ?? 0;
  }

  return lead === '' ? getIndent(trimmedCode) : indicatorMatch.index;
};

export const findYamlCommentLines = (source: string): number[] => {
  const commentLines: number[] = [];
  let blockScalarParentIndent: number | undefined;

  for (const [index, line] of splitLines(source).entries()) {
    const isBlockScalarContent = blockScalarParentIndent !== undefined
      && (line.trim() === '' || getIndent(line) > blockScalarParentIndent);

    if (isBlockScalarContent) {
      continue;
    }

    const commentColumn = findYamlCommentColumn(line);

    if (commentColumn !== undefined) {
      commentLines.push(index + 1);
    }

    blockScalarParentIndent = findBlockScalarParentIndent(commentColumn === undefined ? line : line.slice(0, commentColumn));
  }

  return commentLines;
};
