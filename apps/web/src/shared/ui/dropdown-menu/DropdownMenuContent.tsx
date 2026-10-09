import type {
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react';

import {
  Content,
  Portal,
} from '@radix-ui/react-dropdown-menu';
import { use } from 'react';

import { cn } from '@/shared/lib/cn';

import { DropdownMenuCloseContext } from './DropdownMenuCloseContext';
import {
  DROPDOWN_MENU_CONTENT_CLASS_NAME,
  DROPDOWN_MENU_CONTENT_WIDTH_CLASS_NAMES,
} from './dropdownMenuStyles';

const COLLISION_PADDING_PX = 8;
const SIDE_OFFSET_PX = 8;

interface DropdownMenuContentProps {
  align?: 'center' | 'end' | 'start' | undefined;
  children: ReactNode;
  label: string;
  width?: 'auto' | 'profile' | undefined;
}

export const DropdownMenuContent = ({
  align = 'start',
  children,
  label,
  width = 'auto',
}: DropdownMenuContentProps): ReactElement => {
  const closeMenu = use(DropdownMenuCloseContext);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }

    console.log('> DropdownMenuContent -> handleKeyDown:', { isShift: event.shiftKey, key: event.key });
    event.preventDefault();
    closeMenu();
  };

  return (
    <Portal>
      <Content
        align={align}
        aria-label={label}
        aria-labelledby={undefined}
        className={cn(DROPDOWN_MENU_CONTENT_CLASS_NAME, DROPDOWN_MENU_CONTENT_WIDTH_CLASS_NAMES[width])}
        collisionPadding={COLLISION_PADDING_PX}
        onKeyDown={handleKeyDown}
        sideOffset={SIDE_OFFSET_PX}
      >
        {children}
      </Content>
    </Portal>
  );
};
