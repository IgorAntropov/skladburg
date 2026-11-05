import { normalizeModuleId } from './extractPackageName.ts';

interface DynamicEntryChunkValue {
  dynamicImports?: readonly string[] | undefined;
  facadeModuleId?: null | string | undefined;
  fileName: string;
  isDynamicEntry: boolean;
  moduleIds: readonly string[];
}

interface EntryChunkValue {
  isEntry: boolean;
  moduleIds: readonly string[];
}

const isEntryModule = (moduleId: string, entry: string): boolean =>
  normalizeModuleId(moduleId).endsWith(`/${entry}`);

export const hasEntryModule = (moduleIds: readonly string[], entry: string): boolean =>
  moduleIds.some(moduleId => isEntryModule(moduleId, entry));

export const hasEntryChunk = (chunks: readonly EntryChunkValue[], entries: readonly string[]): boolean =>
  chunks.some(chunk => chunk.isEntry && entries.some(entry => hasEntryModule(chunk.moduleIds, entry)));

export const findDynamicEntryChunks = <TChunk extends DynamicEntryChunkValue>(chunks: readonly TChunk[], entry: string): TChunk[] => {
  const dynamicTargets = new Set(chunks.flatMap(chunk => chunk.dynamicImports ?? []));

  return chunks.filter((chunk) => {
    const isDynamicTarget = chunk.isDynamicEntry || dynamicTargets.has(chunk.fileName);
    const isFacade = typeof chunk.facadeModuleId === 'string' && isEntryModule(chunk.facadeModuleId, entry);

    return isDynamicTarget && (isFacade || hasEntryModule(chunk.moduleIds, entry));
  });
};
