import type {
  HtmlTagDescriptor,
  Plugin,
} from 'vite';

import type { BundleBudgetOutputValue } from '../build-budget/bundleBudgetPlugin.ts';

export type CriticalPreloadBundleValue = Readonly<Record<string, BundleBudgetOutputValue>>;

export interface CriticalPreloadEntryValue {
  entry: string;
  isDemoOnly?: boolean | undefined;
  isRequired: boolean;
}

export interface CriticalPreloadHtmlContextValue {
  bundle?: CriticalPreloadBundleValue | undefined;
  chunk?: undefined | { fileName: string };
}

export interface CriticalPreloadHtmlResultValue {
  html: string;
  tags: HtmlTagDescriptor[];
}

export interface CriticalPreloadOptionsValue {
  deferredEntries: readonly string[];
  entries: readonly CriticalPreloadEntryValue[];
  isDemoTransport: boolean;
  workerDynamicEntries: readonly string[];
  workerEntries: readonly string[];
}

export type CriticalPreloadPluginValue = Omit<Plugin, 'configResolved' | 'transformIndexHtml'> & {
  configResolved: (config: { base: string }) => void;
  transformIndexHtml: {
    handler: (html: string, context: CriticalPreloadHtmlContextValue) => CriticalPreloadHtmlResultValue;
    order: 'post';
  };
};

export interface CriticalPreloadValue {
  plugin: CriticalPreloadPluginValue;
  workerPlugin: () => CriticalPreloadWorkerPluginValue;
}

export type CriticalPreloadWorkerPluginValue = Omit<Plugin, 'generateBundle'> & {
  generateBundle: (options: unknown, bundle: CriticalPreloadBundleValue) => void;
};

export interface PreloadChunkValue {
  fileName: string;
  imports: readonly string[];
  isDynamicEntry: boolean;
  isEntry: boolean;
  moduleIds: readonly string[];
}

export interface PreloadFileValue {
  fileName: string;
  gzipBytes: number;
}
