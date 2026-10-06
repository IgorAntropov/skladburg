import {
  findCssCommentLines,
  findScriptCommentLines,
} from './slash-comments.ts';
import {
  countLineBreaks,
  splitLines,
} from './source-lines.ts';

const embeddedBlockPattern = /<(style|script)\b((?:"[^"]*"|'[^']*'|[^>"'/]|\/(?!>))*)>([\s\S]*?)<\/\1\s*>/gi;

const findMarkerCommentLines = (source: string): number[] => {
  const commentLines: number[] = [];

  splitLines(source).forEach((line, index) => {
    if (line.includes('<!--')) {
      commentLines.push(index + 1);
    }
  });

  return commentLines;
};

const findEmbeddedCommentLines = (source: string): number[] => {
  const commentLines: number[] = [];

  for (const match of source.matchAll(embeddedBlockPattern)) {
    const [, tagName = '', attributes = '', content = ''] = match;

    const contentOffset = match.index + `<${tagName}${attributes}>`.length;
    const firstContentLine = countLineBreaks(source.slice(0, contentOffset)) + 1;
    const findContentComments = tagName.toLowerCase() === 'style' ? findCssCommentLines : findScriptCommentLines;

    for (const contentLine of findContentComments(content)) {
      commentLines.push(firstContentLine + contentLine - 1);
    }
  }

  return commentLines;
};

export const findMarkupCommentLines = (source: string): number[] => {
  const uniqueLines = new Set([...findMarkerCommentLines(source), ...findEmbeddedCommentLines(source)]);

  return [...uniqueLines].sort((first, second) => first - second);
};
