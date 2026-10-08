import type {
  BudgetChunkValue,
  InitialBundleChunkValue,
  InitialBundleValue,
} from './bundleBudgetTypes.ts';

const collectStaticChunks = (
  entry: BudgetChunkValue,
  chunksByFileName: ReadonlyMap<string, BudgetChunkValue>,
): InitialBundleChunkValue[] => {
  const visitedFileNames = new Set<string>();
  const collected: InitialBundleChunkValue[] = [];
  const pending: BudgetChunkValue[] = [entry];

  while (pending.length > 0) {
    const chunk = pending.shift();

    if (chunk === undefined || visitedFileNames.has(chunk.fileName)) {
      continue;
    }

    visitedFileNames.add(chunk.fileName);
    collected.push({ fileName: chunk.fileName, gzipBytes: chunk.gzipBytes });

    for (const importedFileName of chunk.imports) {
      const imported = chunksByFileName.get(importedFileName);

      if (imported !== undefined) {
        pending.push(imported);
      }
    }
  }

  return collected;
};

export const measureInitialBundles = (chunks: readonly BudgetChunkValue[]): InitialBundleValue[] => {
  const chunksByFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));

  return chunks
    .filter(chunk => chunk.isEntry)
    .map((entry) => {
      const initialChunks = collectStaticChunks(entry, chunksByFileName);

      return {
        chunks: initialChunks,
        entryFileName: entry.fileName,
        gzipBytes: initialChunks.reduce((total, chunk) => total + chunk.gzipBytes, 0),
      };
    });
};
