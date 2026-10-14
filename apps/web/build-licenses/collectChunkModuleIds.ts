export type ChunkBundleValue = Readonly<Record<string, { moduleIds: readonly string[]; type: 'chunk' } | { type: 'asset' }>>;

export const addChunkModuleIds = (bundle: ChunkBundleValue, target: Set<string>): void => {
  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') {
      for (const moduleId of output.moduleIds) {
        target.add(moduleId);
      }
    }
  }
};
