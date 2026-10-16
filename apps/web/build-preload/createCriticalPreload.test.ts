import type { HtmlTagDescriptor } from 'vite';

import { build } from 'vite';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TempWorkspaceValue } from '../build-licenses/createTempWorkspace.ts';
import type {
  CriticalPreloadBundleValue,
  CriticalPreloadEntryValue,
  CriticalPreloadOptionsValue,
} from './criticalPreloadTypes.ts';

import { createTempWorkspace } from '../build-licenses/createTempWorkspace.ts';
import { createCriticalPreload } from './createCriticalPreload.ts';

const BASE = '/app/';

const WORKER_ENTRY = 'demo-engine/src/host/worker.ts';

const MOUNT_ENTRY: CriticalPreloadEntryValue = { entry: 'src/mountApp.ts', isRequired: true };

const DEMO_ENTRY: CriticalPreloadEntryValue = { entry: 'src/demo/index.ts', isDemoOnly: true, isRequired: true };

const HTML = [
  '<html><head>',
  '<script type="module" crossorigin src="/app/assets/index.js"></script>',
  '<link rel="modulepreload" crossorigin href="/app/assets/react.js">',
  '<link rel="stylesheet" crossorigin href="/app/assets/index.css">',
  '</head><body></body></html>',
].join('\n');

const createChunkOutput = (
  fileName: string,
  overrides: Partial<Extract<CriticalPreloadBundleValue[string], { type: 'chunk' }>> = {},
): CriticalPreloadBundleValue[string] => ({
  code: `export const name = "${fileName}";`,
  fileName,
  imports: [],
  isDynamicEntry: false,
  isEntry: false,
  moduleIds: [],
  type: 'chunk',
  ...overrides,
});

const createBundle = (): CriticalPreloadBundleValue => ({
  'assets/constants.js': createChunkOutput('assets/constants.js'),
  'assets/demo.js': createChunkOutput('assets/demo.js', {
    imports: ['assets/constants.js', 'assets/react.js'],
    isDynamicEntry: true,
    moduleIds: ['/repo/src/demo/index.ts'],
  }),
  'assets/errors.js': createChunkOutput('assets/errors.js'),
  'assets/index.js': createChunkOutput('assets/index.js', { imports: ['assets/react.js'], isEntry: true }),
  'assets/mount.js': createChunkOutput('assets/mount.js', {
    imports: ['assets/react.js', 'assets/errors.js'],
    isDynamicEntry: true,
    moduleIds: ['/repo/src/mountApp.ts'],
  }),
  'assets/react.js': createChunkOutput('assets/react.js'),
  'assets/worker-wrapper.js': createChunkOutput('assets/worker-wrapper.js', {
    isDynamicEntry: true,
    moduleIds: ['/repo/demo-engine/src/host/worker.ts?worker'],
  }),
});

const createWorkerBundle = (): CriticalPreloadBundleValue => ({
  'assets/engine.js': createChunkOutput('assets/engine.js', { isDynamicEntry: true }),
  'assets/worker.js': createChunkOutput('assets/worker.js', {
    isEntry: true,
    moduleIds: ['/repo/demo-engine/src/host/worker.ts?worker_file&type=module'],
  }),
});

const createPreload = (overrides: Partial<CriticalPreloadOptionsValue> = {}): ReturnType<typeof createCriticalPreload> =>
  createCriticalPreload({
    entries: [MOUNT_ENTRY, DEMO_ENTRY],
    isDemoTransport: true,
    workerEntries: [WORKER_ENTRY],
    ...overrides,
  });

const prepare = (overrides: Partial<CriticalPreloadOptionsValue> = {}): ReturnType<typeof createCriticalPreload> => {
  const preload = createPreload(overrides);

  preload.plugin.configResolved({ base: BASE });
  preload.workerPlugin().generateBundle({}, createWorkerBundle());

  return preload;
};

const readHref = (tag: HtmlTagDescriptor): string => {
  const href = tag.attrs?.href;

  return typeof href === 'string' ? href : '';
};

const describeTags = (tags: readonly HtmlTagDescriptor[]): string[] =>
  tags.map(tag => `${readHref(tag)}${tag.attrs?.fetchpriority === 'low' ? ' low' : ''}`);

describe('createCriticalPreload plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('puts the main thread links before the worker links with the worker links at low priority', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const tags = prepare().plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      chunk: { fileName: 'assets/index.js' },
    });

    expect(describeTags(tags)).toEqual([
      '/app/assets/mount.js',
      '/app/assets/errors.js',
      '/app/assets/demo.js',
      '/app/assets/constants.js',
      '/app/assets/worker-wrapper.js',
      '/app/assets/worker.js low',
      '/app/assets/engine.js low',
    ]);
  });

  it('makes module preload links in the cross origin mode of the module scripts of the page', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const tags = prepare().plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      chunk: { fileName: 'assets/index.js' },
    });

    expect(tags.every(tag => tag.tag === 'link' && tag.injectTo === 'head')).toBe(true);
    expect(tags.every(tag => tag.attrs?.rel === 'modulepreload' && tag.attrs.crossorigin === true)).toBe(true);
  });

  it('does not repeat the chunks of the initial graph and the links already in the page', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = HTML.replace('</head>', '<link rel="modulepreload" crossorigin href="/app/assets/errors.js"></head>');
    const tags = prepare().plugin.transformIndexHtml.handler(html, {
      bundle: createBundle(),
      chunk: { fileName: 'assets/index.js' },
    });
    const hrefs = describeTags(tags);

    expect(hrefs).not.toContain('/app/assets/react.js');
    expect(hrefs).not.toContain('/app/assets/index.js');
    expect(hrefs).not.toContain('/app/assets/errors.js');
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('puts the links under the base of the build', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preload = createPreload();

    preload.plugin.configResolved({ base: '/skladburg' });
    preload.workerPlugin().generateBundle({}, createWorkerBundle());

    const tags = preload.plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      chunk: { fileName: 'assets/index.js' },
    });

    expect(describeTags(tags)[0]).toBe('/skladburg/assets/mount.js');
  });

  it('hints only the main entry without the demo transport', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const tags = prepare({ isDemoTransport: false }).plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      chunk: { fileName: 'assets/index.js' },
    });

    expect(describeTags(tags)).toEqual(['/app/assets/mount.js', '/app/assets/errors.js']);
  });

  it('fails when the bundle has no required entry', () => {
    const bundle = Object.fromEntries(Object.entries(createBundle()).filter(([fileName]) => fileName !== 'assets/mount.js'));

    expect(() => prepare().plugin.transformIndexHtml.handler(HTML, { bundle, chunk: { fileName: 'assets/index.js' } })).toThrow(
      'src/mountApp.ts',
    );
  });

  it('fails when the engine worker was not built before the page', () => {
    const preload = createPreload();

    preload.plugin.configResolved({ base: BASE });

    expect(() =>
      preload.plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), chunk: { fileName: 'assets/index.js' } }),
    ).toThrow('the worker bundle of demo-engine/src/host/worker.ts');
  });

  it('adds no links when the page has no bundle', () => {
    expect(prepare().plugin.transformIndexHtml.handler(HTML, {})).toEqual([]);
  });

  it('logs the size of the main thread links and of the worker links', () => {
    const reports: unknown[] = [];

    vi.spyOn(console, 'log').mockImplementation((_label: unknown, report: unknown) => {
      reports.push(report);
    });

    prepare().plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), chunk: { fileName: 'assets/index.js' } });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      mainThread: { files: expect.arrayContaining([expect.stringContaining('assets/mount.js')]) as unknown },
      worker: { files: [expect.stringContaining('assets/worker.js') as unknown, expect.stringContaining('assets/engine.js') as unknown] },
    });
  });

  it('keeps the entry of the worker recorded by the plugin of the worker bundle only', () => {
    const preload = createPreload();
    const terrainBundle: CriticalPreloadBundleValue = {
      'assets/terrain.js': createChunkOutput('assets/terrain.js', { isEntry: true, moduleIds: ['/repo/src/terrain.worker.ts'] }),
    };

    preload.plugin.configResolved({ base: BASE });
    preload.workerPlugin().generateBundle({}, createWorkerBundle());
    preload.workerPlugin().generateBundle({}, terrainBundle);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const hrefs = describeTags(
      preload.plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), chunk: { fileName: 'assets/index.js' } }),
    );

    expect(hrefs).toContain('/app/assets/worker.js low');
    expect(hrefs).not.toContain('/app/assets/terrain.js low');
  });
});

const workspaces: TempWorkspaceValue[] = [];

const createWorkspace = (): TempWorkspaceValue => {
  const workspace = createTempWorkspace();

  workspaces.push(workspace);

  workspace.writeFile(
    'index.html',
    [
      '<!doctype html><html><head><meta charset="UTF-8"></head>',
      '<body><script type="module" src="/main.ts"></script></body></html>',
      '',
    ].join('\n'),
  );
  workspace.writeFile('main.ts', 'document.title = "main";\nimport("./src/mountApp.ts").then(module => module.mountApp());\n');
  workspace.writeFile(
    'src/mountApp.ts',
    [
      'import { readErrors } from "./errors.ts";',
      'export const mountApp = () => import("./demo/index.ts").then(module => module.connect(readErrors()));',
      '',
    ].join('\n'),
  );
  workspace.writeFile('src/errors.ts', 'export const readErrors = () => Math.random().toString();\n');
  workspace.writeFile(
    'src/demo/index.ts',
    [
      'import { readErrors } from "../errors.ts";',
      'export const connect = async (name: string) => {',
      '  const { default: EngineWorker } = await import("../../demo-engine/src/host/worker.ts?worker");',
      '  return new EngineWorker({ name: name + readErrors() });',
      '};',
      '',
    ].join('\n'),
  );
  workspace.writeFile('demo-engine/src/host/worker.ts', 'import("./core.ts").then(core => core.start());\n');
  workspace.writeFile('demo-engine/src/host/core.ts', 'export const start = () => self.postMessage(Math.random());\n');

  return workspace;
};

const buildHtml = async (workspace: TempWorkspaceValue, options: Partial<CriticalPreloadOptionsValue> = {}): Promise<string> => {
  const preload = createPreload(options);
  const result = await build({
    base: BASE,
    build: { rolldownOptions: { input: 'index.html' }, write: false },
    configFile: false,
    logLevel: 'silent',
    plugins: [preload.plugin],
    root: workspace.root,
    worker: { format: 'es', plugins: () => [preload.workerPlugin()] },
  });
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : [];
  const html = outputs.find(output => output.fileName === 'index.html');

  if (html?.type !== 'asset' || typeof html.source !== 'string') {
    throw new Error('The build produced no index.html');
  }

  return html.source;
};

const readPreloads = (html: string): string[] =>
  [...html.matchAll(/<link\b[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => tag.includes('rel="modulepreload"'))
    .map(tag => `${/href="\/app\/assets\/([a-zA-Z]+)-/.exec(tag)?.[1] ?? '?'}${tag.includes('fetchpriority="low"') ? ' low' : ''}`);

describe('createCriticalPreload in a build', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }

    vi.restoreAllMocks();
  });

  it('builds the worker before the page and hints both graphs', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preloads = readPreloads(await buildHtml(createWorkspace()));

    expect(preloads).toEqual(['mountApp', 'demo', 'worker', 'worker low', 'core low']);
  });

  it('hints only the main entry of the build without the demo transport', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preloads = readPreloads(await buildHtml(createWorkspace(), { entries: [MOUNT_ENTRY], isDemoTransport: false }));

    expect(preloads).toEqual(['mountApp']);
  });

  it('fails the build when a required entry is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      buildHtml(createWorkspace(), { entries: [MOUNT_ENTRY, { entry: 'src/missing.ts', isRequired: true }] }),
    ).rejects.toThrow('Critical preload: the bundle has no required entry: src/missing.ts');
  });
});
