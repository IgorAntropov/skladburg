export interface BudgetChunkValue {
  fileName: string;
  gzipBytes: number;
  imports: readonly string[];
  isEntry: boolean;
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
