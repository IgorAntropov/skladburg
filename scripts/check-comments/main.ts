import {
  existsSync,
  readFileSync,
} from 'node:fs';

import type { CommentDetectorValue } from './types.ts';

import { resolveDetector } from './detectors.ts';
import { listRepositoryFiles } from './repository-files.ts';

const reportFindings = (filePath: string, detector: CommentDetectorValue): boolean => {
  const commentLines = detector.find(readFileSync(filePath, 'utf8'));

  for (const commentLine of commentLines) {
    process.stderr.write(`${filePath}:${String(commentLine)}: comment found (${detector.kind})\n`);
  }

  return commentLines.length > 0;
};

export const main = (): void => {
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
