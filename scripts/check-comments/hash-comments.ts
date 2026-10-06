import { splitLines } from './source-lines.ts';

const findLinesStartingWithMarker = (source: string, markers: string): number[] => {
  const commentLines: number[] = [];

  splitLines(source).forEach((line, index) => {
    const firstCharacter = line.trimStart().charAt(0);

    if (firstCharacter !== '' && markers.includes(firstCharacter)) {
      commentLines.push(index + 1);
    }
  });

  return commentLines;
};

export const findHashLineCommentLines = (source: string): number[] => findLinesStartingWithMarker(source, '#');

export const findHashOrSemicolonLineCommentLines = (source: string): number[] => findLinesStartingWithMarker(source, '#;');
