const RESET_CONFIRM_SHIFT_PX = 4;

export const RESET_CONFIRM_HIDDEN_STATE = { opacity: 0, y: RESET_CONFIRM_SHIFT_PX } as const;

export const RESET_CONFIRM_SHOWN_STATE = { opacity: 1, y: 0 } as const;

export const RESET_CONFIRM_TRANSITION = { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const;

export const RESET_CONFIRM_INSTANT_TRANSITION = { duration: 0 } as const;
