import type {
  Locator,
  Page,
} from '@playwright/test';

import {
  code128,
  drawingSVG,
  qrcode,
} from '@bwip-js/generic';
import { expect } from '@playwright/test';

interface CameraTestWindowValue extends Window {
  warehouseCameraContext?: CanvasRenderingContext2D | undefined;
  warehouseCameraIsDenied?: boolean | undefined;
  warehouseCameraIsHidden?: boolean | undefined;
  warehouseCameraStream?: MediaStream | undefined;
}

export const installCameraTestFeed = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const target: CameraTestWindowValue = window;
    Object.defineProperty(document, 'hidden', { get: (): boolean => target.warehouseCameraIsHidden === true });
    const mediaDevices = navigator.mediaDevices;
    const getUserMedia = (): Promise<MediaStream> => {
      if (target.warehouseCameraIsDenied === true) {
        return Promise.reject(new DOMException('Camera denied in test', 'NotAllowedError'));
      }
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('Expected canvas context');
      }
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const track = new EventTarget();
      const stop = (): void => {
        Object.assign(track, { readyState: 'ended' });
      };
      Object.assign(track, { readyState: 'live', stop });
      const stream = new EventTarget();
      Object.assign(stream, { getTracks: () => [track], getVideoTracks: () => [track] });
      target.warehouseCameraContext = context;
      target.warehouseCameraStream = stream as MediaStream;
      return Promise.resolve(target.warehouseCameraStream);
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: Object.create(mediaDevices, { getUserMedia: { value: getUserMedia } }),
    });
    const sourceObject = new WeakMap<HTMLMediaElement, unknown>();
    const srcObjectDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
    const nativeGet: unknown = srcObjectDescriptor === undefined ? undefined : Reflect.get(srcObjectDescriptor, 'get');
    const nativeSet: unknown = srcObjectDescriptor === undefined ? undefined : Reflect.get(srcObjectDescriptor, 'set');
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get(this: HTMLMediaElement): unknown {
        if (sourceObject.has(this)) {
          return sourceObject.get(this);
        }
        return typeof nativeGet === 'function' ? Reflect.apply(nativeGet, this, []) : null;
      },
      set(this: HTMLMediaElement, value: unknown): void {
        if (value === target.warehouseCameraStream || sourceObject.has(this)) {
          sourceObject.set(this, value);
        }
        else if (typeof nativeSet === 'function') {
          Reflect.apply(nativeSet, this, [value]);
        }
      },
    });
    const play: unknown = Reflect.get(HTMLMediaElement.prototype, 'play');
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
      if (target.warehouseCameraStream !== undefined && this.srcObject === target.warehouseCameraStream) {
        for (const [key, value] of [['readyState', 2], ['videoWidth', 640], ['videoHeight', 480]] as const) {
          Object.defineProperty(this, key, { configurable: true, get: (): number => value });
        }
        return Promise.resolve();
      }
      const result: unknown = typeof play === 'function' ? Reflect.apply(play, this, []) : undefined;
      return result instanceof Promise ? result.then(() => undefined) : Promise.resolve();
    };
    const drawImage: unknown = Reflect.get(CanvasRenderingContext2D.prototype, 'drawImage');
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D, source: CanvasImageSource, ...args: number[]
    ): void {
      const isTestVideo = source instanceof HTMLVideoElement && source.srcObject === target.warehouseCameraStream;
      if (typeof drawImage === 'function') {
        Reflect.apply(drawImage, this, [isTestVideo ? target.warehouseCameraContext?.canvas ?? source : source, ...args]);
      }
    };
  });
};

export const denyCameraTestFeed = async (page: Page, isDenied: boolean): Promise<void> => {
  await page.evaluate((isDenied) => {
    const target: CameraTestWindowValue = window;
    target.warehouseCameraIsDenied = isDenied;
  }, isDenied);
};

export const setCameraTestVisibility = async (page: Page, isHidden: boolean): Promise<void> => {
  await page.evaluate((isHidden) => {
    const target: CameraTestWindowValue = window;
    target.warehouseCameraIsHidden = isHidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, isHidden);
};

export const showCameraCode = async (page: Page, value: string, kind: 'cell' | 'qr'): Promise<void> => {
  const drawing = drawingSVG();
  const symbol = kind === 'cell'
    ? code128({ bcid: 'code128', height: 18, padding: 6, scale: 3, text: value }, drawing)
    : qrcode({ bcid: 'qrcode', padding: 4, scale: 5, text: value }, drawing);
  const svg = symbol.replace(/^<svg viewBox="0 0 (\d+) (\d+)"/u, '<svg width="$1" height="$2" viewBox="0 0 $1 $2"');
  await page.evaluate(async (src) => {
    const target: CameraTestWindowValue = window;
    const context = target.warehouseCameraContext;
    if (context === undefined) {
      throw new Error('Camera test feed is not open');
    }
    const image = new Image();
    image.src = src;
    await image.decode();
    const { height, width } = context.canvas;
    const scale = Math.min(1, (width - 40) / image.width, (height - 40) / image.height);
    const drawWidth = Math.round(image.width * scale);
    const drawHeight = Math.round(image.height * scale);
    context.fillRect(0, 0, width, height);
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }, `data:image/svg+xml,${encodeURIComponent(svg)}`);
};

export const openWarehouseCamera = async (surface: Locator): Promise<Locator> => {
  await surface.getByTestId('warehouse-camera-open').click();
  return surface.getByTestId('warehouse-camera-scanner');
};

export const expectCameraTestFeedStopped = async (page: Page): Promise<void> => {
  await expect.poll(() => page.evaluate(() => {
    const target: CameraTestWindowValue = window;
    return target.warehouseCameraStream?.getTracks().map(track => track.readyState);
  })).toEqual(['ended']);
};
