export interface BudgetChunkValue {
  fileName: string;
  gzipBytes: number;
  imports: readonly string[];
  isDynamicEntry: boolean;
  isEntry: boolean;
  moduleIds: readonly string[];
}

export interface ChunkPackageViolationValue {
  chunkFileName: string;
  packageName: string;
}

export interface ForbiddenPackageViolationValue {
  chunkFileName: string;
  entryFileName: string;
  packageName: string;
}

export interface InitialBundleChunkValue {
  fileName: string;
  gzipBytes: number;
}

export interface InitialBundleValue {
  chunks: readonly InitialBundleChunkValue[];
  entryFileName: string;
  gzipBytes: number;
}

export interface LazyBudgetMeasurementValue {
  budget: LazyEntryBudgetValue;
  chunks: readonly InitialBundleChunkValue[];
  gzipBytes: number;
  missingEntries: readonly string[];
}

export interface LazyEntryBudgetValue {
  entries: readonly string[];
  isRequired?: boolean;
  maxGzipKiloBytes: number;
  name: string;
}
