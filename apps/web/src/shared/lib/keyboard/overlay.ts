export const OVERLAY_SELECTOR = '[role="menu"], [role="dialog"], [role="alertdialog"]';

export const isInsideOverlay = (target: EventTarget | null): boolean => {
  return target instanceof Element && target.closest(OVERLAY_SELECTOR) !== null;
};
