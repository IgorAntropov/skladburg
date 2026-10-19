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
  CriticalPreloadHtmlResultValue,
  CriticalPreloadOptionsValue,
} from './criticalPreloadTypes.ts';

import { createTempWorkspace } from '../build-licenses/createTempWorkspace.ts';
import { createCriticalPreload } from './createCriticalPreload.ts';

const BASE = '/app/';

const WORKER_ENTRY = 'demo-engine/src/host/worker.ts';

const ENGINE_ENTRY = 'demo-engine/src/core/engine/index.ts';

const MOUNT_ENTRY: CriticalPreloadEntryValue = { entry: 'src/mountApp.ts', isRequired: true };

const DEMO_ENTRY: CriticalPreloadEntryValue = { entry: 'src/demo/index.ts', isDemoOnly: true, isRequired: true };

const HTML = [
  '<html><head>',
  '<script type="module" crossorigin src="/app/assets/index.js"></script>',
  '<link rel="modulepreload" crossorigin href="/app/assets/react.js">',
  '<link rel="stylesheet" crossorigin href="/app/assets/index.css">',
  '</head><body></body></html>',
].join('\n');

const INDEX_CONTEXT = { chunk: { fileName: 'assets/index.js' } };

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
  'assets/engine.js': createChunkOutput('assets/engine.js', {
    isDynamicEntry: true,
    moduleIds: ['/repo/demo-engine/src/core/engine/index.ts'],
  }),
  'assets/validator.js': createChunkOutput('assets/validator.js', {
    isDynamicEntry: true,
    moduleIds: ['/repo/demo-engine/src/core/validator/index.ts'],
  }),
  'assets/worker.js': createChunkOutput('assets/worker.js', {
    isEntry: true,
    moduleIds: ['/repo/demo-engine/src/host/worker.ts?worker_file&type=module'],
  }),
});

const createPreload = (overrides: Partial<CriticalPreloadOptionsValue> = {}): ReturnType<typeof createCriticalPreload> =>
  createCriticalPreload({
    deferredEntries: [],
    entries: [MOUNT_ENTRY, DEMO_ENTRY],
    isDemoTransport: true,
    workerDynamicEntries: [ENGINE_ENTRY],
    workerEntries: [WORKER_ENTRY],
    ...overrides,
  });

const prepare = (overrides: Partial<CriticalPreloadOptionsValue> = {}): ReturnType<typeof createCriticalPreload> => {
  const preload = createPreload(overrides);

  preload.plugin.configResolved({ base: BASE });
  preload.workerPlugin().generateBundle({}, createWorkerBundle());

  return preload;
};

const transform = (overrides: Partial<CriticalPreloadOptionsValue> = {}, html = HTML): CriticalPreloadHtmlResultValue => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  return prepare(overrides).plugin.transformIndexHtml.handler(html, { bundle: createBundle(), ...INDEX_CONTEXT });
};

const readHref = (tag: HtmlTagDescriptor): string => {
  const href = tag.attrs?.href;

  return typeof href === 'string' ? href : '';
};

const describeTags = (tags: readonly HtmlTagDescriptor[]): string[] =>
  tags.map(tag => tag.tag === 'script' ? 'inline script' : `${readHref(tag)}${tag.attrs?.fetchpriority === 'low' ? ' low' : ''}`);

const readInlineScript = (tags: readonly HtmlTagDescriptor[]): string => {
  const children = tags.find(tag => tag.tag === 'script')?.children;

  return typeof children === 'string' ? children : '';
};

const DEFERRED_V3 = [WORKER_ENTRY, ENGINE_ENTRY];

const TRIGGER_LIST_PATTERN = /s=(\[(?:"(?:[^"\\]|\\.)*",?)*\])/;

const readStringList = (script: string, pattern: RegExp): string[] => {
  const list: unknown = JSON.parse(pattern.exec(script)?.[1] ?? '[]');

  return Array.isArray(list) ? list.map(String) : [];
};

const readTriggerSelectors = (tags: readonly HtmlTagDescriptor[]): string[] =>
  readStringList(readInlineScript(tags), TRIGGER_LIST_PATTERN);

describe('createCriticalPreload plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('puts the main thread links before the worker links with the worker links at low priority', () => {
    expect(describeTags(transform().tags)).toEqual([
      '/app/assets/mount.js',
      '/app/assets/errors.js',
      '/app/assets/demo.js',
      '/app/assets/constants.js',
      '/app/assets/worker-wrapper.js',
      '/app/assets/worker.js low',
      '/app/assets/engine.js low',
    ]);
  });

  it('keeps the script of the worker and the engine out of the page when they are deferred and then adds the inline script', () => {
    expect(describeTags(transform({ deferredEntries: DEFERRED_V3 }).tags)).toEqual([
      '/app/assets/mount.js',
      '/app/assets/errors.js',
      '/app/assets/demo.js',
      '/app/assets/constants.js',
      '/app/assets/worker-wrapper.js',
      'inline script',
    ]);
  });

  it('lists the deferred files in the inline script with the base of the build', () => {
    const script = readInlineScript(transform({ deferredEntries: DEFERRED_V3 }).tags);

    expect(script).toContain('["/app/assets/worker.js","/app/assets/engine.js"]');
  });

  it('waits for the stylesheet and then the entry script', () => {
    const { tags } = transform({ deferredEntries: DEFERRED_V3 });

    expect(readTriggerSelectors(tags)).toEqual(['link[href="/app/assets/index.css"]', 'script[src="/app/assets/index.js"]']);
  });

  it('waits for the entry script only when the page has no stylesheet', () => {
    const html = HTML.replace('<link rel="stylesheet" crossorigin href="/app/assets/index.css">', '');
    const { tags } = transform({ deferredEntries: DEFERRED_V3 }, html);

    expect(readTriggerSelectors(tags)).toEqual(['script[src="/app/assets/index.js"]']);
  });

  it('logs the selectors of the trigger', () => {
    const reports: unknown[] = [];

    vi.spyOn(console, 'log').mockImplementation((_label: unknown, report: unknown) => {
      reports.push(report);
    });

    prepare({ deferredEntries: DEFERRED_V3 }).plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      ...INDEX_CONTEXT,
    });

    expect(reports[0]).toMatchObject({
      deferredTriggers: ['link[href="/app/assets/index.css"]', 'script[src="/app/assets/index.js"]'],
    });
  });

  it('defers only the engine and leaves the script of the worker on the page at low priority', () => {
    expect(describeTags(transform({ deferredEntries: [ENGINE_ENTRY] }).tags).slice(-2)).toEqual([
      '/app/assets/worker.js low',
      'inline script',
    ]);
  });

  it('defers the main thread entries of the variant with the page hinting only the first one', () => {
    const { tags } = transform({ deferredEntries: [DEMO_ENTRY.entry, `${WORKER_ENTRY}?worker`, WORKER_ENTRY, ENGINE_ENTRY] });

    expect(describeTags(tags)).toEqual(['/app/assets/mount.js', '/app/assets/errors.js', 'inline script']);
    expect(readInlineScript(tags)).toContain(
      '["/app/assets/demo.js","/app/assets/constants.js","/app/assets/worker-wrapper.js","/app/assets/worker.js","/app/assets/engine.js"]',
    );
  });

  it('puts no lazy chunk of the worker outside the listed points into the page or the inline script', () => {
    const { html, tags } = transform({ deferredEntries: DEFERRED_V3 });

    expect(html).not.toContain('validator.js');
    expect(describeTags(tags).join()).not.toContain('validator.js');
    expect(readInlineScript(tags)).not.toContain('validator.js');
  });

  it('marks the entry script and the stylesheet with the high fetch priority', () => {
    const { html } = transform();

    expect(html).toContain('<script fetchpriority="high" type="module" crossorigin src="/app/assets/index.js"></script>');
    expect(html).toContain('<link fetchpriority="high" rel="stylesheet" crossorigin href="/app/assets/index.css">');
    expect(html.match(/fetchpriority="high"/g)).toHaveLength(2);
  });

  it('makes module preload links in the cross origin mode of the module scripts of the page', () => {
    const links = transform({ deferredEntries: DEFERRED_V3 }).tags.filter(tag => tag.tag === 'link');

    expect(links.every(tag => tag.injectTo === 'head')).toBe(true);
    expect(links.every(tag => tag.attrs?.rel === 'modulepreload' && tag.attrs.crossorigin === true)).toBe(true);
  });

  it('puts the inline script after every link and into the head', () => {
    const { tags } = transform({ deferredEntries: DEFERRED_V3 });

    expect(tags.at(-1)).toMatchObject({ injectTo: 'head', tag: 'script' });
    expect(tags.slice(0, -1).every(tag => tag.tag === 'link')).toBe(true);
  });

  it('does not repeat the chunks of the initial graph and the links already in the page', () => {
    const html = HTML.replace('</head>', '<link rel="modulepreload" crossorigin href="/app/assets/errors.js"></head>');
    const hrefs = describeTags(transform({}, html).tags);

    expect(hrefs).not.toContain('/app/assets/react.js');
    expect(hrefs).not.toContain('/app/assets/index.js');
    expect(hrefs).not.toContain('/app/assets/errors.js');
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('puts the links and the inline script under the base of the build', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preload = createPreload({ deferredEntries: DEFERRED_V3 });
    const html = HTML.replaceAll('/app/', '/skladburg/');

    preload.plugin.configResolved({ base: '/skladburg' });
    preload.workerPlugin().generateBundle({}, createWorkerBundle());

    const { tags } = preload.plugin.transformIndexHtml.handler(html, { bundle: createBundle(), ...INDEX_CONTEXT });

    expect(describeTags(tags)[0]).toBe('/skladburg/assets/mount.js');
    expect(readInlineScript(tags)).toContain('["/skladburg/assets/worker.js","/skladburg/assets/engine.js"]');
  });

  it('hints only the main entry without the demo transport and adds no inline script', () => {
    const { html, tags } = transform({ deferredEntries: DEFERRED_V3, isDemoTransport: false });

    expect(describeTags(tags)).toEqual(['/app/assets/mount.js', '/app/assets/errors.js']);
    expect(html).toContain('fetchpriority="high" type="module"');
  });

  it('fails when the bundle has no required entry', () => {
    const bundle = Object.fromEntries(Object.entries(createBundle()).filter(([fileName]) => fileName !== 'assets/mount.js'));

    expect(() => prepare().plugin.transformIndexHtml.handler(HTML, { bundle, ...INDEX_CONTEXT })).toThrow('src/mountApp.ts');
  });

  it('fails when the engine worker was not built before the page', () => {
    const preload = createPreload();

    preload.plugin.configResolved({ base: BASE });

    expect(() => preload.plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), ...INDEX_CONTEXT })).toThrow(
      'the worker bundle of demo-engine/src/host/worker.ts',
    );
  });

  it('fails when a dynamic point of the worker is missing from the worker bundle', () => {
    const preload = createPreload({ workerDynamicEntries: [ENGINE_ENTRY, 'demo-engine/src/core/missing.ts'] });

    preload.plugin.configResolved({ base: BASE });
    preload.workerPlugin().generateBundle({}, createWorkerBundle());

    expect(() => preload.plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), ...INDEX_CONTEXT })).toThrow(
      'demo-engine/src/core/missing.ts in the worker bundle',
    );
  });

  it('fails when the page has no script with the address of the entry', () => {
    const html = HTML.replace('<script type="module" crossorigin src="/app/assets/index.js"></script>', '');

    expect(() => transform({}, html)).toThrow('the page has no entry script with the address /app/assets/index.js');
  });

  it('fails when a deferred list names an entry the plugin does not know', () => {
    expect(() => createPreload({ deferredEntries: ['src/missing.ts'] })).toThrow(
      'Critical preload: deferredEntries names entries the plugin does not know: src/missing.ts',
    );
  });

  it('adds no links when the page has no bundle', () => {
    expect(prepare().plugin.transformIndexHtml.handler(HTML, {})).toEqual({ html: HTML, tags: [] });
  });

  it('logs the size of the main thread links, of the worker links, of the deferred links and of the inline script', () => {
    const reports: unknown[] = [];

    vi.spyOn(console, 'log').mockImplementation((_label: unknown, report: unknown) => {
      reports.push(report);
    });

    const { tags } = prepare({ deferredEntries: [ENGINE_ENTRY] }).plugin.transformIndexHtml.handler(HTML, {
      bundle: createBundle(),
      ...INDEX_CONTEXT,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      deferred: { files: [expect.stringContaining('assets/engine.js') as unknown] },
      inlineScriptBytes: Buffer.byteLength(readInlineScript(tags)),
      mainThread: { files: expect.arrayContaining([expect.stringContaining('assets/mount.js')]) as unknown },
      worker: { files: [expect.stringContaining('assets/worker.js') as unknown] },
    });
    expect(Buffer.byteLength(readInlineScript(tags))).toBeGreaterThan(0);
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
      preload.plugin.transformIndexHtml.handler(HTML, { bundle: createBundle(), ...INDEX_CONTEXT }).tags,
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
  workspace.writeFile('style.css', 'body { margin: 0; }\n');
  workspace.writeFile(
    'main.ts',
    [
      'import "./style.css";',
      'document.title = "main";',
      'import("./src/mountApp.ts").then(module => module.mountApp());',
      '',
    ].join('\n'),
  );
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
  workspace.writeFile(
    'demo-engine/src/host/worker.ts',
    [
      'import("./core.ts").then(core => core.start());',
      'self.addEventListener("message", () => import("./extra.ts").then(extra => extra.run()));',
      '',
    ].join('\n'),
  );
  workspace.writeFile('demo-engine/src/host/core.ts', 'export const start = () => self.postMessage(Math.random());\n');
  workspace.writeFile('demo-engine/src/host/extra.ts', 'export const run = () => self.postMessage("extra" + Math.random());\n');

  return workspace;
};

const CORE_ENTRY = 'demo-engine/src/host/core.ts';

const buildHtml = async (workspace: TempWorkspaceValue, options: Partial<CriticalPreloadOptionsValue> = {}): Promise<string> => {
  const preload = createPreload({ workerDynamicEntries: [CORE_ENTRY], ...options });
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

const readChunkName = (href: string): string => /\/app\/assets\/([a-zA-Z]+)-/.exec(href)?.[1] ?? '?';

const readPreloads = (html: string): string[] =>
  [...html.matchAll(/<link\b[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => tag.includes('rel="modulepreload"'))
    .map(tag => `${readChunkName(/href="([^"]*)"/.exec(tag)?.[1] ?? '')}${tag.includes('fetchpriority="low"') ? ' low' : ''}`);

const readDeferredHrefs = (html: string): string[] =>
  readStringList(html, /var d=0,u=(\[[^\]]*\])/).map(readChunkName);

const readTriggerSelectorsOfPage = (html: string): string[] => readStringList(html, TRIGGER_LIST_PATTERN);

describe('createCriticalPreload in a build', () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      workspace.remove();
    }

    vi.restoreAllMocks();
  });

  it('builds the worker before the page and hints the startup path of both graphs but not a lazy chunk of the worker', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = await buildHtml(createWorkspace());

    expect(readPreloads(html)).toEqual(['mountApp', 'demo', 'worker', 'worker low', 'core low']);
    expect(html).not.toContain('extra-');
  });

  it('moves the script of the worker and its dynamic point behind the entry script', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = await buildHtml(createWorkspace(), { deferredEntries: ['demo-engine/src/host/worker.ts', CORE_ENTRY] });

    expect(readPreloads(html)).toEqual(['mountApp', 'demo', 'worker']);
    expect(readDeferredHrefs(html)).toEqual(['worker', 'core']);
    expect(html).not.toContain('extra-');
    expect(html.lastIndexOf('<script>')).toBeGreaterThan(html.lastIndexOf('<link'));
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'));
  });

  it('waits for the stylesheet of the build and then the entry script', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = await buildHtml(createWorkspace(), { deferredEntries: ['demo-engine/src/host/worker.ts', CORE_ENTRY] });

    const [stylesheetSelector, entrySelector] = readTriggerSelectorsOfPage(html);

    expect(stylesheetSelector).toMatch(/^link\[href="\/app\/assets\/index-[^"]+\.css"\]$/);
    expect(entrySelector).toMatch(/^script\[src="\/app\/assets\/index-[^"]+\.js"\]$/);
  });

  it('marks the entry script of the build with the high fetch priority', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = await buildHtml(createWorkspace());

    expect(html).toMatch(/<script fetchpriority="high" type="module" crossorigin src="\/app\/assets\/index-[^"]+\.js"><\/script>/);
  });

  it('hints only the main entry of the build without the demo transport and adds no inline script', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const html = await buildHtml(createWorkspace(), {
      deferredEntries: ['demo-engine/src/host/worker.ts', CORE_ENTRY],
      entries: [MOUNT_ENTRY],
      isDemoTransport: false,
    });

    expect(readPreloads(html)).toEqual(['mountApp']);
    expect(html).not.toContain('<script>');
  });

  it('fails the build when a required entry is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      buildHtml(createWorkspace(), { entries: [MOUNT_ENTRY, { entry: 'src/missing.ts', isRequired: true }] }),
    ).rejects.toThrow('Critical preload: the bundle has no required entry: src/missing.ts');
  });

  it('fails the build when a dynamic point of the worker is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      buildHtml(createWorkspace(), { workerDynamicEntries: ['demo-engine/src/host/missing.ts'] }),
    ).rejects.toThrow('demo-engine/src/host/missing.ts in the worker bundle');
  });
});
