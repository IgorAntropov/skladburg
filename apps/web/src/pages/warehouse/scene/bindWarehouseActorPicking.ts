export interface WarehouseActorHitValue {
  button: HTMLButtonElement;
  distanceSq: number;
}

type WarehouseActorPickerValue = (x: number, y: number, radius: number) => undefined | WarehouseActorHitValue;

interface WarehouseCanvasPickingValue {
  dispose: () => void;
  pickers: Set<WarehouseActorPickerValue>;
}

const TAP_SLOP_PX = 5;
const bindings = new WeakMap<HTMLElement, WarehouseCanvasPickingValue>();

const createCanvasPicking = (canvas: HTMLElement): WarehouseCanvasPickingValue => {
  const pickers = new Set<WarehouseActorPickerValue>();
  let down: PointerEvent | undefined;
  let pending: HTMLButtonElement | undefined;
  const handlePointerDown = (event: PointerEvent): void => {
    down = event.isPrimary && event.button === 0 ? event : undefined;
    pending = undefined;
  };
  const handlePointerMove = (event: PointerEvent): void => {
    if (down !== undefined && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > TAP_SLOP_PX) {
      down = undefined;
    }
  };
  const handlePointerUp = (event: PointerEvent): void => {
    const start = down;
    handlePointerMove(event);
    if (down !== undefined && start?.pointerId === event.pointerId && event.button === 0) {
      const rect = canvas.getBoundingClientRect();
      let nearest: undefined | WarehouseActorHitValue;
      for (const pick of pickers) {
        const hit = pick(event.clientX - rect.left, event.clientY - rect.top, event.pointerType === 'touch' ? 22 : 12);
        if (hit !== undefined && (nearest === undefined || hit.distanceSq < nearest.distanceSq)) {
          nearest = hit;
        }
      }
      pending = nearest?.button;
    }
    down = undefined;
  };
  const handlePointerCancel = (): void => {
    down = undefined;
    pending = undefined;
  };
  const handleClick = (event: MouseEvent): void => {
    const button = pending;
    pending = undefined;
    if (button?.isConnected === true && event.button === 0) {
      event.stopImmediatePropagation();
      button.focus({ preventScroll: true });
      button.click();
    }
  };
  const listeners = { capture: true, passive: true } as const;
  canvas.addEventListener('pointerdown', handlePointerDown, listeners);
  canvas.addEventListener('pointermove', handlePointerMove, listeners);
  canvas.addEventListener('pointerup', handlePointerUp, listeners);
  canvas.addEventListener('pointercancel', handlePointerCancel, listeners);
  canvas.addEventListener('click', handleClick, listeners);
  const dispose = (): void => {
    canvas.removeEventListener('pointerdown', handlePointerDown, true);
    canvas.removeEventListener('pointermove', handlePointerMove, true);
    canvas.removeEventListener('pointerup', handlePointerUp, true);
    canvas.removeEventListener('pointercancel', handlePointerCancel, true);
    canvas.removeEventListener('click', handleClick, true);
  };
  return { dispose, pickers };
};

export const bindWarehouseActorPicking = (canvas: HTMLElement, pick: WarehouseActorPickerValue): (() => void) => {
  const binding = bindings.get(canvas) ?? createCanvasPicking(canvas);
  bindings.set(canvas, binding);
  binding.pickers.add(pick);
  return (): void => {
    binding.pickers.delete(pick);
    if (binding.pickers.size === 0) {
      binding.dispose();
      bindings.delete(canvas);
    }
  };
};
