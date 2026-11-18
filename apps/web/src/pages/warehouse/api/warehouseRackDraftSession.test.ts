import type { Mock } from 'vitest';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

import type { WarehouseRackPlacementValue } from '../model/warehouseRackPlacement';

import { createWarehouseRackDraftSession } from './warehouseRackDraftSession';

interface DraftFixtureValue {
  layout: {
    openWarehouseLayoutSession: Mock;
    putWarehouseLayoutDraft: Mock;
    releaseWarehouseLayoutSession: Mock;
    renewWarehouseLayoutSession: Mock;
  };
  session: ReturnType<typeof createWarehouseRackDraftSession>;
}

const placementAt = (xMm: number): WarehouseRackPlacementValue => ({
  cells: [{ cellCode: 'Z1-R1-S1-L1-C1', xOffsetMm: xMm }],
  expectedRevision: 4,
  footprint: { depthMm: 1_200, origin: { xMm, zMm: 0 }, widthMm: 2_400 },
  rackCode: 'S1',
  rowId: 'row',
  warehouseId: 'warehouse',
  zoneId: 'zone',
});

const createGate = <T>(): { promise: Promise<T>; resolve: (response: T) => void } => {
  let resolve: (response: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

const createFixture = (): DraftFixtureValue => {
  const layout = {
    openWarehouseLayoutSession: vi.fn().mockImplementation(() => Promise.resolve({
      expiresAt: timestampFromMs(Date.now() + 120_000),
      layoutSessionId: 'session',
    })),
    putWarehouseLayoutDraft: vi.fn().mockResolvedValueOnce({ draftRevision: 1 }).mockResolvedValue({ draftRevision: 2 }),
    releaseWarehouseLayoutSession: vi.fn().mockResolvedValue({}),
    renewWarehouseLayoutSession: vi.fn().mockImplementation(() => Promise.resolve({
      expiresAt: timestampFromMs(Date.now() + 120_000),
    })),
  };

  return { layout, session: createWarehouseRackDraftSession(layout) };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('coalesces queued positions and publishes the latest with the acknowledged draft revision', async () => {
  const { layout, session } = createFixture();
  const first = createGate<{ draftRevision: number }>();
  layout.putWarehouseLayoutDraft.mockReset().mockReturnValueOnce(first.promise).mockResolvedValue({ draftRevision: 2 });
  const initial = placementAt(100);
  const newest = placementAt(400);

  session.select(initial);
  await vi.advanceTimersByTimeAsync(200);
  session.select(placementAt(200));
  session.select(newest);
  await vi.advanceTimersByTimeAsync(200);
  expect(layout.putWarehouseLayoutDraft).toHaveBeenCalledTimes(1);
  first.resolve({ draftRevision: 1 });
  await vi.advanceTimersByTimeAsync(200);

  expect(layout.openWarehouseLayoutSession).toHaveBeenCalledTimes(1);
  expect(layout.putWarehouseLayoutDraft).toHaveBeenNthCalledWith(2, expect.objectContaining({
    cells: newest.cells,
    expectedDraftRevision: 1,
    expectedRevision: 4,
    layoutSessionId: 'session',
  }));
  expect(session.read().published).toEqual({ draft: newest, layoutSessionId: 'session' });
  await session.release();
});

it('replays the uncertain publication before sending a newer position', async () => {
  const { layout, session } = createFixture();
  layout.putWarehouseLayoutDraft.mockReset()
    .mockRejectedValueOnce(new ConnectError('lost reply', Code.Unavailable))
    .mockResolvedValueOnce({ draftRevision: 1 })
    .mockResolvedValueOnce({ draftRevision: 2 });
  session.select(placementAt(100));
  await vi.advanceTimersByTimeAsync(200);

  session.select(placementAt(200));
  await vi.advanceTimersByTimeAsync(300);
  expect(layout.putWarehouseLayoutDraft).toHaveBeenCalledTimes(3);
  expect(layout.putWarehouseLayoutDraft.mock.calls[1]).toEqual(layout.putWarehouseLayoutDraft.mock.calls[0]);
  expect(layout.putWarehouseLayoutDraft).toHaveBeenNthCalledWith(3, expect.objectContaining({ expectedDraftRevision: 1 }));
  await session.release();
});

it('releases a session opened just before confirmed leave without publishing after leave', async () => {
  const { layout, session } = createFixture();
  const opened = createGate<{ expiresAt: ReturnType<typeof timestampFromMs>; layoutSessionId: string }>();
  layout.openWarehouseLayoutSession.mockReturnValue(opened.promise);
  session.select(placementAt(100));
  await vi.advanceTimersByTimeAsync(200);

  const leaving = session.release();
  opened.resolve({ expiresAt: timestampFromMs(Date.now() + 120_000), layoutSessionId: 'session' });
  await leaving;
  expect(layout.putWarehouseLayoutDraft).not.toHaveBeenCalled();
  expect(layout.releaseWarehouseLayoutSession).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(layout.renewWarehouseLayoutSession).not.toHaveBeenCalled();
});

it('recovers the exact open call when leaving after a lost response', async () => {
  const { layout, session } = createFixture();
  layout.openWarehouseLayoutSession.mockRejectedValueOnce(new ConnectError('lost open response', Code.Unavailable));
  session.select(placementAt(100));
  await vi.advanceTimersByTimeAsync(200);

  await session.release();

  expect(layout.openWarehouseLayoutSession).toHaveBeenCalledTimes(2);
  expect(layout.openWarehouseLayoutSession.mock.calls[1]?.[0]).toEqual(layout.openWarehouseLayoutSession.mock.calls[0]?.[0]);
  expect(layout.releaseWarehouseLayoutSession).toHaveBeenCalledOnce();
  expect(layout.putWarehouseLayoutDraft).not.toHaveBeenCalled();
});

it('waits for an outstanding renewal before saving and leaves the committed lease cleanup to the engine', async () => {
  const { layout, session } = createFixture();
  const renewal = createGate<{ expiresAt: ReturnType<typeof timestampFromMs> }>();
  layout.renewWarehouseLayoutSession.mockReturnValue(renewal.promise);
  const save = vi.fn().mockResolvedValue('saved');
  session.select(placementAt(100));
  await vi.advanceTimersByTimeAsync(30_200);

  const saving = session.commit(save);
  expect(save).not.toHaveBeenCalled();
  renewal.resolve({ expiresAt: timestampFromMs(Date.now() + 120_000) });
  await expect(saving).resolves.toBe('saved');
  await session.release();
  await vi.advanceTimersByTimeAsync(30_000);

  expect(session.read().published).toBeUndefined();
  expect(layout.renewWarehouseLayoutSession).toHaveBeenCalledOnce();
  expect(layout.releaseWarehouseLayoutSession).not.toHaveBeenCalled();
});

it('renews the open session and restarts a draft only on explicit input after its deadline', async () => {
  const { layout, session } = createFixture();
  session.select(placementAt(100));
  await vi.advanceTimersByTimeAsync(30_200);
  expect(layout.renewWarehouseLayoutSession).toHaveBeenCalledOnce();
  layout.renewWarehouseLayoutSession.mockRejectedValue(new ConnectError('transport interrupted', Code.Unavailable));
  await vi.advanceTimersByTimeAsync(120_000);

  expect(session.read().published).toBeUndefined();
  expect(session.read().isExpired).toBe(true);
  expect(layout.openWarehouseLayoutSession).toHaveBeenCalledOnce();
  session.retry();
  await vi.advanceTimersByTimeAsync(200);
  expect(layout.openWarehouseLayoutSession).toHaveBeenCalledTimes(2);
  expect(session.read().isExpired).toBe(false);
  await session.release();
});
