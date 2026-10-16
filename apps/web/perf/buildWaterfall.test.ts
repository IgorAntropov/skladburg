import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import { buildWaterfall } from './buildWaterfall.ts';

const BASE = 'https://host/skladburg/assets';

const createRequest = (fileName: string, startAt: number, overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes: 1000,
  endAt: startAt + 100,
  fromCache: false,
  startAt,
  target: 'page',
  url: `${BASE}/${fileName}`,
  ...overrides,
});

const findRow = (rows: ReturnType<typeof buildWaterfall>, label: string): RequestValue | undefined => (
  rows.find(row => row.label === label)?.request
);

describe('buildWaterfall', () => {
  it('finds each key file by its hashed name', () => {
    const rows = buildWaterfall([
      createRequest('index-Ka_enA0r.js', 10),
      createRequest('mountApp-BNleIwnQ.js', 400),
      createRequest('demo-zt3dE9Y4.js', 900),
      createRequest('engine-BYddzchM.js', 1500, { target: 'worker' }),
      createRequest('network-HWMHU8xM.js', 2000),
      createRequest('index-Bxhqw5mi.css', 20),
    ]);

    expect(findRow(rows, 'index')?.startAt).toBe(10);
    expect(findRow(rows, 'mountApp')?.startAt).toBe(400);
    expect(findRow(rows, 'demo')?.startAt).toBe(900);
    expect(findRow(rows, 'engine core')?.target).toBe('worker');
    expect(findRow(rows, 'network section')?.startAt).toBe(2000);
    expect(findRow(rows, 'css')?.url).toMatch(/\.css$/);
  });

  it('tells the worker wrapper from the worker script by order of request', () => {
    const rows = buildWaterfall([
      createRequest('worker-Bde9Yxd9.js', 1200),
      createRequest('worker-D5G7UmoC.js', 1000),
    ]);

    expect(findRow(rows, 'worker wrapper')?.url).toContain('worker-D5G7UmoC.js');
    expect(findRow(rows, 'worker script')?.url).toContain('worker-Bde9Yxd9.js');
  });

  it('does not take the terrain worker for the engine worker', () => {
    const rows = buildWaterfall([createRequest('worldTerrain.worker-B6xL-RFa.js', 3000)]);

    expect(findRow(rows, 'worker wrapper')).toBeUndefined();
  });

  it('keeps the first request of a repeated file', () => {
    const rows = buildWaterfall([createRequest('demo-zt3dE9Y4.js', 900), createRequest('demo-zt3dE9Y4.js', 1700)]);

    expect(findRow(rows, 'demo')?.startAt).toBe(900);
  });

  it('leaves a row empty when the file was never requested', () => {
    expect(findRow(buildWaterfall([]), 'engine core')).toBeUndefined();
  });

  it('reports every font file separately', () => {
    const rows = buildWaterfall([
      createRequest('manrope-latin-DHIcAJRg.woff2', 500),
      createRequest('manrope-cyrillic-Dvxsihut.woff2', 450),
    ]);

    expect(findRow(rows, 'font')?.url).toContain('cyrillic');
    expect(findRow(rows, 'font (second)')?.url).toContain('latin');
  });

  it('shows a revalidation as its own row and keeps the full download in the key file row', () => {
    const rows = buildWaterfall([
      createRequest('worker-XkuRDHIr.js', 100, { bytes: 32_000 }),
      createRequest('worker-XkuRDHIr.js', 900, { bytes: 300, isRevalidated: true }),
    ]);

    expect(findRow(rows, 'worker wrapper')?.bytes).toBe(32_000);
    expect(findRow(rows, 'worker script')).toBeUndefined();
    expect(rows.filter(row => row.label === 'revalidation (304)').map(row => row.request?.startAt)).toEqual([900]);
  });

  it('adds no revalidation rows when there were none', () => {
    expect(buildWaterfall([createRequest('index-Ka_enA0r.js', 10)]).some(row => row.label === 'revalidation (304)')).toBe(false);
  });
});
