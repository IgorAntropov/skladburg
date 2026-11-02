export const CATALOG_ROW_CLASS_NAME = [
  'flex w-full cursor-pointer touch-manipulation flex-col gap-2 rounded-control border border-line px-3 py-2 text-left',
  '@lg:flex-row @lg:gap-4',
  'motion-safe:transition-[background-color,border-color]',
  'hover:bg-hover active:bg-line',
  'aria-[current=true]:border-indicator aria-[current=true]:bg-hover aria-[current=true]:ring-1 aria-[current=true]:ring-indicator',
  'aria-[current=true]:ring-inset aria-[current=true]:active:bg-line',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');
