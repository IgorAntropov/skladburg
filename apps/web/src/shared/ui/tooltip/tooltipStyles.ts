export const TOOLTIP_CONTENT_CLASS_NAME = [
  'z-50 flex min-h-8 max-w-64 items-center gap-2 rounded-control border border-on-panel/30 bg-panel-solid px-2.5 py-1.5',
  'text-xs leading-4 font-medium text-on-panel shadow-raised select-none has-[kbd]:pr-1.5',
  'origin-(--radix-tooltip-content-transform-origin) data-[state=delayed-open]:motion-safe:animate-menu-in',
  'data-[side=bottom]:[--menu-in-y:-4px] data-[side=top]:[--menu-in-y:4px]',
  'data-[side=left]:[--menu-in-x:4px] data-[side=right]:[--menu-in-x:-4px]',
].join(' ');

export const TOOLTIP_LABEL_CLASS_NAME = 'min-w-0 text-pretty wrap-break-word';

export const TOOLTIP_SHORTCUT_CLASS_NAME = [
  'shrink-0 rounded-sm border border-line bg-hover px-1.5 font-sans text-xs leading-4 font-semibold text-on-panel',
  'shadow-[inset_0_-1px_0_var(--color-line)]',
].join(' ');
