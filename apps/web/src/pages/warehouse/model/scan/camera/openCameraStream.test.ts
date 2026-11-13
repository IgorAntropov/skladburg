import {
  expect,
  it,
  vi,
} from 'vitest';

import { openCameraStream } from './openCameraStream';

it('stops every track when a permission request resolves after the scanner closes', async () => {
  const controller = new AbortController();
  const stops = [vi.fn(), vi.fn()];
  const stream = { getTracks: () => stops.map(stop => ({ stop })) };
  let resolveCamera: ((value: typeof stream) => void) | undefined;
  const pending = new Promise<typeof stream>((resolve) => {
    resolveCamera = resolve;
  });
  const request = vi.fn(() => pending);
  const opening = openCameraStream(request, controller.signal);
  controller.abort();
  await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
  resolveCamera?.(stream);
  await pending;
  expect(stops.every(stop => stop.mock.calls.length === 1)).toBe(true);
  expect(request).toHaveBeenCalledWith({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, height: { ideal: 720 }, width: { ideal: 1280 } },
  });
});

it('does not request hardware for a session that has already ended', async () => {
  const request = vi.fn<() => Promise<MediaStream>>();
  await expect(openCameraStream(request, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).not.toHaveBeenCalled();
});
