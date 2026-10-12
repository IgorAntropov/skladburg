export interface BudgetChunkValue {
  fileName: string;
  gzipBytes: number;
  imports: readonly string[];
  isEntry: boolean;
  moduleIds: readonly string[];
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
