import { normalizeModuleId } from './extractPackageName.ts';

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
