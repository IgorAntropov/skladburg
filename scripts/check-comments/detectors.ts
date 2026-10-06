import {
  basename,
  extname,
} from 'node:path';

import type { CommentDetectorValue } from './types.ts';

import {
  findHashLineCommentLines,
  findHashOrSemicolonLineCommentLines,
} from './hash-comments.ts';
import { findInvalidJsonLines } from './json-comments.ts';
import { findMarkupCommentLines } from './markup-comments.ts';
import {
  findCssCommentLines,
  findProtoCommentLines,
} from './slash-comments.ts';
import { findYamlCommentLines } from './yaml-comments.ts';

const skippedFileNames: ReadonlySet<string> = new Set(['pnpm-lock.yaml']);
const hashLineFileNames: ReadonlySet<string> = new Set(['.gitignore', '.nvmrc']);
const hashOrSemicolonLineFileNames: ReadonlySet<string> = new Set(['.npmrc']);

export const cssDetector: CommentDetectorValue = { find: findCssCommentLines, kind: 'css' };
export const hashLineDetector: CommentDetectorValue = { find: findHashLineCommentLines, kind: 'hash-line' };
export const hashOrSemicolonLineDetector: CommentDetectorValue = {
  find: findHashOrSemicolonLineCommentLines,
  kind: 'hash-or-semicolon-line',
};
export const htmlDetector: CommentDetectorValue = { find: findMarkupCommentLines, kind: 'html' };
export const jsonDetector: CommentDetectorValue = { find: findInvalidJsonLines, kind: 'json' };
export const protoDetector: CommentDetectorValue = { find: findProtoCommentLines, kind: 'proto' };
export const svgDetector: CommentDetectorValue = { find: findMarkupCommentLines, kind: 'svg' };
export const yamlDetector: CommentDetectorValue = { find: findYamlCommentLines, kind: 'yaml' };

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

export const resolveDetector = (filePath: string): CommentDetectorValue | undefined => {
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
