import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createWorldModelLoader } from './createWorldModelLoader';
import { COMPANY_WAREHOUSE_MODEL_ID } from './worldModelCatalog';
import { createTestWorldModelBytes } from './worldModelTestSupport';

const OTHER_MODEL_ID = 'commercial/building-a';

describe('createWorldModelLoader', () => {
  it('asks for the file of a model by the base url and the catalog path', async () => {
    const fetchBuffer = vi.fn(() => Promise.resolve(createTestWorldModelBytes()));
    const load = createWorldModelLoader(fetchBuffer);

    await load([COMPANY_WAREHOUSE_MODEL_ID]);

    expect(fetchBuffer).toHaveBeenCalledExactlyOnceWith(`${import.meta.env.BASE_URL}models/industrial/building-k.bin`);
  });

  it('returns the parsed models by id', async () => {
    const load = createWorldModelLoader(() => Promise.resolve(createTestWorldModelBytes()));

    const models = await load([COMPANY_WAREHOUSE_MODEL_ID, OTHER_MODEL_ID]);

    expect([...models.keys()]).toEqual([COMPANY_WAREHOUSE_MODEL_ID, OTHER_MODEL_ID]);
    expect(models.get(OTHER_MODEL_ID)?.triangleCount).toBe(1);
    expect(models.get(OTHER_MODEL_ID)?.vertexCount).toBe(3);
  });

  it('makes one request for a model however many times and in whatever way it is asked', async () => {
    const fetchBuffer = vi.fn(() => Promise.resolve(createTestWorldModelBytes()));
    const load = createWorldModelLoader(fetchBuffer);

    const first = load([COMPANY_WAREHOUSE_MODEL_ID]);
    const second = load([COMPANY_WAREHOUSE_MODEL_ID, OTHER_MODEL_ID]);
    await Promise.all([first, second]);
    await load([OTHER_MODEL_ID]);

    expect(fetchBuffer).toHaveBeenCalledTimes(2);
  });

  it('gives the same parsed model on every call', async () => {
    const load = createWorldModelLoader(() => Promise.resolve(createTestWorldModelBytes()));

    const first = await load([COMPANY_WAREHOUSE_MODEL_ID]);
    const second = await load([COMPANY_WAREHOUSE_MODEL_ID]);

    expect(second.get(COMPANY_WAREHOUSE_MODEL_ID)).toBe(first.get(COMPANY_WAREHOUSE_MODEL_ID));
  });

  it('peeks nothing before the model is loaded and the model after', async () => {
    const load = createWorldModelLoader(() => Promise.resolve(createTestWorldModelBytes()));

    expect(load.peek(COMPANY_WAREHOUSE_MODEL_ID)).toBeUndefined();

    const models = await load([COMPANY_WAREHOUSE_MODEL_ID]);

    expect(load.peek(COMPANY_WAREHOUSE_MODEL_ID)).toBe(models.get(COMPANY_WAREHOUSE_MODEL_ID));
    expect(load.peek(OTHER_MODEL_ID)).toBeUndefined();
  });

  it('does not cache a failed request and asks again next time', async () => {
    const fetchBuffer = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(createTestWorldModelBytes());
    const load = createWorldModelLoader(fetchBuffer);

    await expect(load([COMPANY_WAREHOUSE_MODEL_ID])).rejects.toThrow('offline');
    expect(load.peek(COMPANY_WAREHOUSE_MODEL_ID)).toBeUndefined();

    const models = await load([COMPANY_WAREHOUSE_MODEL_ID]);

    expect(models.size).toBe(1);
    expect(fetchBuffer).toHaveBeenCalledTimes(2);
  });

  it('does not cache a file that cannot be read', async () => {
    const fetchBuffer = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockResolvedValueOnce(new ArrayBuffer(8))
      .mockResolvedValue(createTestWorldModelBytes());
    const load = createWorldModelLoader(fetchBuffer);

    await expect(load([COMPANY_WAREHOUSE_MODEL_ID])).rejects.toThrow('World model: file is shorter than the header');
    await expect(load([COMPANY_WAREHOUSE_MODEL_ID])).resolves.toHaveProperty('size', 1);
  });

  it('rejects an id that is not in the catalog without a request', async () => {
    const fetchBuffer = vi.fn(() => Promise.resolve(createTestWorldModelBytes()));
    const load = createWorldModelLoader(fetchBuffer);

    await expect(load(['industrial/unknown'])).rejects.toThrow('World model: unknown id industrial/unknown');
    expect(fetchBuffer).not.toHaveBeenCalled();
  });
});
