import {
  expect,
  it,
  vi,
} from 'vitest';

import { startCameraScanner } from './startCameraScanner';

it('reports an unavailable camera and never creates a Worker', async () => {
  const onError = vi.fn();
  const createWorker = vi.fn<() => Worker>();
  const video = document.createElement('video');
  const controller = new AbortController();
  await startCameraScanner({ createWorker, onCode: vi.fn(), onError, onReady: vi.fn(), signal: controller.signal, video });
  expect(onError).toHaveBeenCalledWith('warehouseWork.cameraUnavailable');
  expect(createWorker).not.toHaveBeenCalled();
});

it('stops the stream and the Worker when no camera frame arrives after initialization', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const stop = vi.fn();
  const track = new EventTarget();
  const stream = { getTracks: () => [{ stop }], getVideoTracks: () => [track] };
  const worker = new EventTarget();
  const terminate = vi.fn();
  Object.assign(worker, { postMessage: vi.fn(), terminate });
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  const canvas = document.createElement('canvas');
  vi.spyOn(document, 'createElement').mockReturnValue(canvas);
  const context = {} as CanvasRenderingContext2D;
  vi.spyOn(canvas, 'getContext').mockReturnValue(context);
  const onError = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });

  try {
    await startCameraScanner({
      createWorker: () => worker as Worker,
      onCode: vi.fn(),
      onError,
      onReady: vi.fn(),
      signal: controller.signal,
      video,
    });
    worker.dispatchEvent(new MessageEvent('message', { data: { kind: 'ready' } }));
    await vi.advanceTimersByTimeAsync(16_000);
    expect(onError).toHaveBeenCalledWith('warehouseWork.cameraFailed');
    expect(stop).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  }
  finally {
    controller.abort();
    Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});
