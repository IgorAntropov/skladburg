export const DROPDOWN_MENU_CONTENT_CLASS_NAME = [
  'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-y-auto',
  'rounded-panel border border-line bg-panel-solid p-1.5 text-on-panel shadow-panel',
  'origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:motion-safe:animate-menu-in',
  'data-[side=bottom]:[--menu-in-y:-4px] data-[side=top]:[--menu-in-y:4px]',
  'data-[side=left]:[--menu-in-x:4px] data-[side=right]:[--menu-in-x:-4px]',
].join(' ');

export const DROPDOWN_MENU_CONTENT_WIDTH_CLASS_NAMES = {
  auto: '',
  profile: 'w-[min(22rem,calc(100vw-1rem))]',
} as const satisfies Record<'auto' | 'profile', string>;

export const DROPDOWN_MENU_ITEM_CLASS_NAME = [
  'flex min-h-11 cursor-default items-center gap-2 rounded-control px-3 py-2 text-base outline-none select-none',
  'data-highlighted:bg-line focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
  'data-disabled:pointer-events-none data-disabled:text-on-panel-muted',
].join(' ');

export const DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME = 'flex size-4 shrink-0 items-center justify-center';

export const DROPDOWN_MENU_LABEL_CLASS_NAME = 'px-3 py-2 text-sm font-medium text-on-panel-muted';

export const DROPDOWN_MENU_SEPARATOR_CLASS_NAME = 'mx-3 my-1.5 h-px bg-line';
