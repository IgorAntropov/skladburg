const TAP_SLOP_PX = 5;

export const bindWarehouseStaffPicking = (
  canvas: HTMLElement, pick: (x: number, y: number, radius: number) => HTMLButtonElement | undefined,
): (() => void) => {
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
      pending = pick(event.clientX - rect.left, event.clientY - rect.top, event.pointerType === 'touch' ? 22 : 12);
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
  return (): void => {
    canvas.removeEventListener('pointerdown', handlePointerDown, true);
    canvas.removeEventListener('pointermove', handlePointerMove, true);
    canvas.removeEventListener('pointerup', handlePointerUp, true);
    canvas.removeEventListener('pointercancel', handlePointerCancel, true);
    canvas.removeEventListener('click', handleClick, true);
  };
};
