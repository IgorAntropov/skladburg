import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  basename,
  extname,
} from 'node:path';

interface CommentDetectorValue {
  find: (source: string) => number[];
  kind: string;
}

const lineBreakPattern = /\r?\n/;
const whitespacePattern = /\s/;
const jsonErrorLinePattern = /line (\d+)/;
const yamlQuoteOpeningPredecessors = ':-,[{?';
const skippedFileNames: ReadonlySet<string> = new Set(['pnpm-lock.yaml']);

const findLinesIncluding = (source: string, marker: string): number[] => {
  const commentLines: number[] = [];

  source.split(lineBreakPattern).forEach((line, index) => {
    if (line.includes(marker)) {
      commentLines.push(index + 1);
    }
  });

  return commentLines;
};

const findLinesStartingWithMarker = (source: string, markers: string): number[] => {
  const commentLines: number[] = [];

  source.split(lineBreakPattern).forEach((line, index) => {
    const firstCharacter = line.trimStart().charAt(0);

    if (firstCharacter !== '' && markers.includes(firstCharacter)) {
      commentLines.push(index + 1);
    }
  });

  return commentLines;
};

const findHashLineCommentLines = (source: string): number[] => findLinesStartingWithMarker(source, '#');

const findHashOrSemicolonLineCommentLines = (source: string): number[] => findLinesStartingWithMarker(source, '#;');

const findSlashCommentLines = (source: string, hasLineCommentSyntax: boolean): number[] => {
  const commentLines: number[] = [];
  let lineNumber = 1;
  let openQuote: string | undefined;
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);

    if (character === '\n') {
      lineNumber += 1;
      openQuote = undefined;
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
    else if (character === '"' || character === '\'') {
      openQuote = character;
    }
    else if (source.startsWith('/*', index)) {
      commentLines.push(lineNumber);
      const blockEnd = source.indexOf('*/', index + 2);
      const blockBoundary = blockEnd === -1 ? source.length : blockEnd + 2;
      lineNumber += source.slice(index, blockBoundary).split('\n').length - 1;
      index = blockBoundary - 1;
    }
    else if (hasLineCommentSyntax && source.startsWith('//', index)) {
      commentLines.push(lineNumber);
      const lineEnd = source.indexOf('\n', index);
      index = lineEnd === -1 ? source.length : lineEnd - 1;
    }

    index += 1;
  }

  return commentLines;
};

const findCssCommentLines = (source: string): number[] => findSlashCommentLines(source, false);

const findProtoCommentLines = (source: string): number[] => findSlashCommentLines(source, true);

const findMarkupCommentLines = (source: string): number[] => findLinesIncluding(source, '<!--');

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

const findYamlCommentLines = (source: string): number[] => {
  const commentLines: number[] = [];

  source.split(lineBreakPattern).forEach((line, index) => {
    if (findYamlCommentColumn(line) !== undefined) {
      commentLines.push(index + 1);
    }
  });

  return commentLines;
};

const byteOrderMark = '\uFEFF';

const findInvalidJsonLines = (source: string): number[] => {
  try {
    JSON.parse(source.startsWith(byteOrderMark) ? source.slice(byteOrderMark.length) : source);
    return [];
  }
  catch (error) {
    const errorLineMatch = error instanceof Error ? jsonErrorLinePattern.exec(error.message) : null;

    return [Number(errorLineMatch?.[1] ?? 1)];
  }
};

const cssDetector: CommentDetectorValue = { find: findCssCommentLines, kind: 'css' };
const hashLineDetector: CommentDetectorValue = { find: findHashLineCommentLines, kind: 'hash-line' };
const hashOrSemicolonLineDetector: CommentDetectorValue = {
  find: findHashOrSemicolonLineCommentLines,
  kind: 'hash-or-semicolon-line',
};
const htmlDetector: CommentDetectorValue = { find: findMarkupCommentLines, kind: 'html' };
const jsonDetector: CommentDetectorValue = { find: findInvalidJsonLines, kind: 'json' };
const protoDetector: CommentDetectorValue = { find: findProtoCommentLines, kind: 'proto' };
const svgDetector: CommentDetectorValue = { find: findMarkupCommentLines, kind: 'svg' };
const yamlDetector: CommentDetectorValue = { find: findYamlCommentLines, kind: 'yaml' };

const detectorsByExtension: ReadonlyMap<string, CommentDetectorValue> = new Map([
  ['.css', cssDetector],
  ['.html', htmlDetector],
  ['.json', jsonDetector],
  ['.proto', protoDetector],
  ['.scss', cssDetector],
  ['.svg', svgDetector],
  ['.yaml', yamlDetector],
  ['.yml', yamlDetector],
]);

const hashLineFileNames: ReadonlySet<string> = new Set(['.gitignore', '.nvmrc']);
const hashOrSemicolonLineFileNames: ReadonlySet<string> = new Set(['.npmrc']);

const resolveDetector = (filePath: string): CommentDetectorValue | undefined => {
  const fileName = basename(filePath);

  if (skippedFileNames.has(fileName)) {
    return undefined;
  }

  if (hashOrSemicolonLineFileNames.has(fileName)) {
    return hashOrSemicolonLineDetector;
  }

  const isHashLineFile = hashLineFileNames.has(fileName) || fileName === '.env' || fileName.startsWith('.env.');

  return isHashLineFile ? hashLineDetector : detectorsByExtension.get(extname(fileName));
};

const listRepositoryFiles = (): string[] =>
  execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps', 'packages', 'scripts', ':(glob)*'],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(filePath => filePath !== '' && existsSync(filePath));

const reportFindings = (filePath: string, detector: CommentDetectorValue): boolean => {
  const commentLines = detector.find(readFileSync(filePath, 'utf8'));

  for (const commentLine of commentLines) {
    process.stderr.write(`${filePath}:${String(commentLine)}: comment found (${detector.kind})\n`);
  }

  return commentLines.length > 0;
};

const main = (): void => {
  const passedPaths = process.argv.slice(2);
  const targetPaths = passedPaths.length > 0 ? passedPaths : listRepositoryFiles();
  let hasProblems = false;

  for (const targetPath of targetPaths) {
    if (!existsSync(targetPath)) {
      process.stderr.write(`${targetPath}: file not found\n`);
      hasProblems = true;
      continue;
    }

    const detector = resolveDetector(targetPath);

    if (detector !== undefined && reportFindings(targetPath, detector)) {
      hasProblems = true;
    }
  }

  if (hasProblems) {
    process.exitCode = 1;
  }
};

main();
