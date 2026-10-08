const BUTTON_BASE_CLASS_NAME = [
  'min-h-12 rounded-md px-6 py-2 text-base font-medium',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  'disabled:opacity-60',
].join(' ');

export const PRIMARY_BUTTON_CLASS_NAME = `${BUTTON_BASE_CLASS_NAME} bg-primary text-on-primary`;

export const SECONDARY_BUTTON_CLASS_NAME = `${BUTTON_BASE_CLASS_NAME} border border-primary text-primary`;
