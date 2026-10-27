import type {
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import {
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from '@/shared/lib/cn';

import { getNextTabIndex } from './getNextTabIndex';

export interface TabsItemValue {
  content: ReactNode;
  count?: number | undefined;
  id: string;
  label: string;
}

export interface TabsProps {
  className?: string | undefined;
  defaultTabId?: string | undefined;
  items: readonly TabsItemValue[];
  label: string;
}

const ROOT_CLASS_NAME = 'flex min-h-0 flex-1 flex-col';

const LIST_CLASS_NAME = 'flex shrink-0 gap-1 overflow-x-auto border-b border-line';

const TRIGGER_CLASS_NAME = [
  'relative inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center gap-2',
  'rounded-t-control px-3 text-base font-medium whitespace-nowrap text-on-panel-muted select-none',
  'motion-safe:transition-[background-color,color]',
  'data-[state=inactive]:hover:bg-hover data-[state=inactive]:hover:text-on-panel',
  'data-[state=active]:font-semibold data-[state=active]:text-on-panel',
  'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full',
  'data-[state=active]:after:bg-indicator',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

const COUNT_CLASS_NAME = 'inline-block min-w-6 rounded-full bg-skeleton px-2 text-center text-sm text-on-panel tabular-nums';

const CONTENT_CLASS_NAME = [
  'flex min-h-0 flex-1 flex-col overflow-y-auto rounded-control p-3',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const Tabs = ({
  className,
  defaultTabId,
  items,
  label,
}: TabsProps): ReactElement => {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | undefined>(defaultTabId ?? items[0]?.id);

  const hasSelectedItem = items.some(item => item.id === selectedTabId);
  const activeTabId = hasSelectedItem ? selectedTabId : items[0]?.id;
  const activeItem = items.find(item => item.id === activeTabId);

  const selectTab = (nextTabId: string): void => {
    if (nextTabId === selectedTabId) {
      return;
    }

    console.log('> Tabs -> selectTab:', { nextTabId });
    setSelectedTabId(nextTabId);
  };

  const handleTabMouseDown = (event: MouseEvent<HTMLButtonElement>, tabId: string): void => {
    if (event.button !== 0 || event.ctrlKey) {
      event.preventDefault();
      return;
    }

    selectTab(tabId);
  };

  const handleTabFocus = (tabId: string): void => {
    selectTab(tabId);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: string, tabIndex: number): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      selectTab(tabId);
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    const nextIndex = getNextTabIndex(event.key, tabIndex, items.length);
    const nextItem = nextIndex === undefined ? undefined : items[nextIndex];

    if (nextItem === undefined) {
      return;
    }

    event.preventDefault();
    selectTab(nextItem.id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex ?? 0]?.focus();
  };

  return (
    <div className={cn(ROOT_CLASS_NAME, className)}>
      <div
        aria-label={label}
        aria-orientation="horizontal"
        className={LIST_CLASS_NAME}
        ref={listRef}
        role="tablist"
      >
        {items.map((item, itemIndex) => {
          const isActive = item.id === activeTabId;
          const state = isActive ? 'active' : 'inactive';

          const handleMouseDown = (event: MouseEvent<HTMLButtonElement>): void => {
            handleTabMouseDown(event, item.id);
          };

          const handleFocus = (): void => {
            handleTabFocus(item.id);
          };

          const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
            handleTabKeyDown(event, item.id, itemIndex);
          };

          return (
            <button
              aria-controls={`${baseId}-content-${item.id}`}
              aria-selected={isActive}
              className={TRIGGER_CLASS_NAME}
              data-orientation="horizontal"
              data-state={state}
              id={`${baseId}-trigger-${item.id}`}
              key={item.id}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              onMouseDown={handleMouseDown}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span>
                {item.label}
                {item.count !== undefined && (
                  <>
                    {' '}
                    <span className={COUNT_CLASS_NAME}>{item.count}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {activeItem !== undefined && (
        <div
          aria-labelledby={`${baseId}-trigger-${activeItem.id}`}
          className={CONTENT_CLASS_NAME}
          data-orientation="horizontal"
          data-state="active"
          id={`${baseId}-content-${activeItem.id}`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
};
