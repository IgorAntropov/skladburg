import type { PreloadChunkValue } from './criticalPreloadTypes.ts';

export const collectImportClosure = (
  rootFileNames: readonly string[],
  chunks: readonly PreloadChunkValue[],
  skippedFileNames: ReadonlySet<string> = new Set(),
): string[] => {
  const chunksByFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const visitedFileNames = new Set<string>();
  const collected: string[] = [];

  for (const rootFileName of rootFileNames) {
    const pending = [rootFileName];

    while (pending.length > 0) {
      const fileName = pending.shift();

      if (fileName === undefined || visitedFileNames.has(fileName) || skippedFileNames.has(fileName)) {
        continue;
      }

      visitedFileNames.add(fileName);

      const chunk = chunksByFileName.get(fileName);

      if (chunk !== undefined) {
        collected.push(fileName);
        pending.push(...chunk.imports);
      }
    }
  }

  return collected;
};
