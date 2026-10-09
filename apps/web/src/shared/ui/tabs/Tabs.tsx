import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  Content,
  List,
  Root,
  Trigger,
} from '@radix-ui/react-tabs';

import { cn } from '@/shared/lib/cn';

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

const LIST_CLASS_NAME = [
  'flex shrink-0 gap-1 overflow-x-auto border-b border-line',
  'in-[[role=tabpanel]]:gap-2 in-[[role=tabpanel]]:border-b-0 in-[[role=tabpanel]]:pb-2',
].join(' ');

const TRIGGER_CLASS_NAME = [
  'group/tab relative inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center gap-2',
  'rounded-t-control px-3 text-base font-medium whitespace-nowrap text-on-panel-muted select-none',
  'motion-safe:transition-[background-color,color]',
  'data-[state=inactive]:hover:bg-skeleton data-[state=inactive]:hover:text-on-panel',
  'data-[state=active]:font-semibold data-[state=active]:text-on-panel',
  'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full',
  'data-[state=active]:after:bg-indicator',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
  'in-[[role=tabpanel]]:rounded-full in-[[role=tabpanel]]:px-4 in-[[role=tabpanel]]:after:hidden',
  'in-[[role=tabpanel]]:data-[state=active]:bg-indicator in-[[role=tabpanel]]:data-[state=active]:text-panel-solid',
].join(' ');

const COUNT_CLASS_NAME = [
  'inline-block min-w-6 rounded-full bg-skeleton px-2 text-center text-sm text-on-panel tabular-nums',
  'in-[[role=tabpanel]]:group-data-[state=active]/tab:bg-panel-solid',
].join(' ');

const CONTENT_CLASS_NAME = [
  'flex min-h-0 flex-1 flex-col overflow-y-auto rounded-control p-3',
  'in-[[role=tabpanel]]:p-0 in-[[role=tabpanel]]:pt-1',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const Tabs = ({
  className,
  defaultTabId,
  items,
  label,
}: TabsProps): ReactElement => {
  const firstTabId = items[0]?.id;
  const initialTabId = defaultTabId ?? firstTabId;

  const handleValueChange = (nextTabId: string): void => {
    console.log('> Tabs -> handleValueChange:', { nextTabId });
  };

  return (
    <Root
      className={cn(ROOT_CLASS_NAME, className)}
      defaultValue={initialTabId}
      onValueChange={handleValueChange}
    >
      <List aria-label={label} className={LIST_CLASS_NAME}>
        {items.map(item => (
          <Trigger className={TRIGGER_CLASS_NAME} key={item.id} value={item.id}>
            <span>
              {item.label}
              {item.count !== undefined && (
                <>
                  {' '}
                  <span className={COUNT_CLASS_NAME}>{item.count}</span>
                </>
              )}
            </span>
          </Trigger>
        ))}
      </List>
      {items.map(item => (
        <Content className={CONTENT_CLASS_NAME} key={item.id} value={item.id}>
          {item.content}
        </Content>
      ))}
    </Root>
  );
};
