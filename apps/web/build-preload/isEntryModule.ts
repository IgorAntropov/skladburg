import { normalizeModuleId } from '../build-budget/extractPackageName.ts';

export const isEntryModule = (moduleId: string, entry: string): boolean =>
  normalizeModuleId(moduleId).endsWith(`/${entry}`);

export const hasEntryModule = (moduleIds: readonly string[], entry: string): boolean =>
  moduleIds.some(moduleId => isEntryModule(moduleId, entry));
