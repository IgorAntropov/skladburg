export interface AssetBudgetFileValue {
  bytes: number;
  fileName: string;
}

export interface AssetBudgetMeasurementValue {
  budget: AssetBudgetValue;
  bytes: number;
  files: readonly AssetBudgetFileValue[];
}

export interface AssetBudgetValue {
  directory: string;
  extensions: readonly string[];
  isRequired: boolean;
  maxKiloBytes: number;
  name: string;
}

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
  forbiddenPackages?: readonly string[];
  isRequired?: boolean;
  maxGzipKiloBytes: number;
  name: string;
}
