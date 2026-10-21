export interface PointerSampleValue {
  button: number;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
}

export const TAP_SLOP_PX = 5;

const PRIMARY_BUTTON = 0;

export const isTapGesture = (down: PointerSampleValue, up: PointerSampleValue, slopPx = TAP_SLOP_PX): boolean => {
  const isSamePointer = down.pointerId === up.pointerId;
  const isPrimaryButton = down.button === PRIMARY_BUTTON && up.button === PRIMARY_BUTTON;

  return isSamePointer && isPrimaryButton && Math.hypot(up.x - down.x, up.y - down.y) <= slopPx;
};
