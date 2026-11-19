import type {
  JSHandle,
  Locator,
  Page,
} from '@playwright/test';

export interface DockHandoffTraceValue {
  frame: string | undefined;
  stop: () => void;
}

export interface TruckCabPositionValue {
  x: number;
  y: number;
}

export const readTruckCabPositions = (
  page: Page,
  screenshot: Buffer,
  minimumCabPixels = 100,
): Promise<TruckCabPositionValue[]> => page.evaluate(async ({ base64, minimumCabPixels }): Promise<TruckCabPositionValue[]> => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();

  const surface = document.createElement('canvas');
  const { naturalHeight: height, naturalWidth: width } = image;
  surface.width = width;
  surface.height = height;
  const context = surface.getContext('2d');
  if (context === null) {
    throw new Error('Could not read the warehouse scene screenshot');
  }
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  const cabPixels = new Uint8Array(width * height);
  for (let pixel = 0; pixel < cabPixels.length; pixel += 1) {
    const offset = pixel * 4;
    const green = data[offset + 1] ?? 0;
    const red = data[offset] ?? 0;
    const blue = data[offset + 2] ?? 0;
    cabPixels[pixel] = red - green >= 20 && blue - green >= 16 ? 1 : 0;
  }

  const cabs: TruckCabPositionValue[] = [];
  for (let pixel = 0; pixel < cabPixels.length; pixel += 1) {
    if (cabPixels[pixel] !== 1) {
      continue;
    }
    const component = [pixel];
    cabPixels[pixel] = 0;
    let sumX = 0;
    let sumY = 0;
    for (const current of component) {
      const column = current % width;
      sumX += column;
      sumY += Math.floor(current / width);
      for (const next of [
        current - width,
        current + width,
        column > 0 ? current - 1 : -1,
        column < width - 1 ? current + 1 : -1,
      ]) {
        if (cabPixels[next] === 1) {
          cabPixels[next] = 0;
          component.push(next);
        }
      }
    }
    if (component.length >= minimumCabPixels) {
      cabs.push({ x: sumX / component.length, y: sumY / component.length });
    }
  }

  return cabs;
}, { base64: screenshot.toString('base64'), minimumCabPixels });

export const watchDockHandoff = (
  canvas: Locator,
  d04: TruckCabPositionValue,
  d06: TruckCabPositionValue,
  rearParking: TruckCabPositionValue,
): Promise<JSHandle<DockHandoffTraceValue>> => canvas.evaluateHandle((element, anchors): DockHandoffTraceValue => {
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error('Expected the warehouse canvas to track the handoff');
  }
  const context = element.getContext('webgl2');
  if (context === null) {
    throw new Error('Expected a WebGL2 context to track the handoff');
  }
  const { height, width } = element.getBoundingClientRect();
  const { drawingBufferHeight, drawingBufferWidth } = context;
  const size = 7;
  const radius = Math.floor(size / 2);
  const [middleDock, farDock, rearSlot] = anchors.map(({ x, y }) => ({
    x: Math.floor(x * drawingBufferWidth / width) - radius,
    y: drawingBufferHeight - Math.floor(y * drawingBufferHeight / height) - radius - 1,
  }));
  if (middleDock === undefined || farDock === undefined || rearSlot === undefined) {
    throw new Error('Could not locate the handoff landmarks in the WebGL buffer');
  }
  const pixels = new Uint8Array(size * size * 4);
  const drawElements = context.drawElements.bind(context);
  const drawElementsInstanced = context.drawElementsInstanced.bind(context);
  const trace: DockHandoffTraceValue = {
    frame: undefined,
    stop: () => {
      Reflect.deleteProperty(context, 'drawElements');
      Reflect.deleteProperty(context, 'drawElementsInstanced');
    },
  };
  let isSampleQueued = false;
  let sawBothDocksVacant = false;

  const hasCabAtPosition = ({ x, y }: TruckCabPositionValue): boolean => {
    context.readPixels(x, y, size, size, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let cabPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const green = pixels[offset + 1] ?? 0;
      if ((pixels[offset] ?? 0) - green >= 20 && (pixels[offset + 2] ?? 0) - green >= 16) {
        cabPixels += 1;
      }
    }
    return cabPixels > size;
  };

  const scheduleSample = (): void => {
    if (isSampleQueued || trace.frame !== undefined) {
      return;
    }
    isSampleQueued = true;
    queueMicrotask(() => {
      isSampleQueued = false;
      const isD04Occupied = hasCabAtPosition(middleDock);
      if (!sawBothDocksVacant) {
        sawBothDocksVacant = !isD04Occupied && !hasCabAtPosition(farDock);
        return;
      }
      if (isD04Occupied && !hasCabAtPosition(farDock) && hasCabAtPosition(rearSlot)) {
        trace.frame = element.toDataURL('image/png');
      }
    });
  };
  context.drawElements = (...args): void => {
    drawElements(...args);
    scheduleSample();
  };
  context.drawElementsInstanced = (...args): void => {
    drawElementsInstanced(...args);
    scheduleSample();
  };
  return trace;
}, [d04, d06, rearParking]);
