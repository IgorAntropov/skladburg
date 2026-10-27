export const NOTICE_CLASS_NAME = [
  'fixed z-10 flex flex-col gap-3 rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised',
  'top-[calc(var(--top-bar-row-min-height)+1px+env(safe-area-inset-top)+0.75rem)] right-[max(0.75rem,env(safe-area-inset-right))]',
  'w-max max-w-[min(36rem,calc(100vw-1.5rem))] [--menu-in-y:-4px] motion-safe:animate-menu-in',
  'max-sm:left-[max(0.75rem,env(safe-area-inset-left))] max-sm:w-auto max-sm:max-w-none',
  'sm:flex-row sm:items-center sm:gap-4',
].join(' ');

export const MESSAGE_CLASS_NAME = 'flex min-w-0 items-center gap-3';

export const ICON_BADGE_CLASS_NAME = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary';

export const ACTIONS_CLASS_NAME = 'flex items-center gap-2 max-sm:*:flex-1 sm:shrink-0';
