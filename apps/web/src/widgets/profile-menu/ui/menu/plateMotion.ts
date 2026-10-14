const PLATE_SHIFT_PX = 4;

export const PLATE_HIDDEN_STATE = { opacity: 0, y: PLATE_SHIFT_PX } as const;

export const PLATE_SHOWN_STATE = { opacity: 1, y: 0 } as const;

export const PLATE_TRANSITION = { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const;

export const PLATE_INSTANT_TRANSITION = { duration: 0 } as const;
