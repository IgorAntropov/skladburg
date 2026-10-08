import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  Content,
  Portal,
} from '@radix-ui/react-dropdown-menu';

import { DROPDOWN_MENU_CONTENT_CLASS_NAME } from './dropdownMenuStyles';

const COLLISION_PADDING_PX = 8;
const SIDE_OFFSET_PX = 8;

interface DropdownMenuContentProps {
  align?: 'center' | 'end' | 'start' | undefined;
  children: ReactNode;
  label: string;
}

export const DropdownMenuContent = ({ align = 'start', children, label }: DropdownMenuContentProps): ReactElement => {
  return (
    <Portal>
      <Content
        align={align}
        aria-label={label}
        aria-labelledby={undefined}
        className={DROPDOWN_MENU_CONTENT_CLASS_NAME}
        collisionPadding={COLLISION_PADDING_PX}
        sideOffset={SIDE_OFFSET_PX}
      >
        {children}
      </Content>
    </Portal>
  );
};
