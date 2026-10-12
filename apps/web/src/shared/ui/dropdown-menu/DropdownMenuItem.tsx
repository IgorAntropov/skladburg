import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Item } from '@radix-ui/react-dropdown-menu';

import { DROPDOWN_MENU_ITEM_CLASS_NAME } from './dropdownMenuStyles';

interface DropdownMenuItemProps {
  children: ReactNode;
  disabled?: boolean | undefined;
  onSelect: (event: Event) => void;
  testId?: string | undefined;
}

export const DropdownMenuItem = ({ children, disabled, onSelect, testId }: DropdownMenuItemProps): ReactElement => {
  const handleSelect = (event: Event): void => {
    console.log('> DropdownMenuItem -> handleSelect:', {});
    onSelect(event);
  };

  return (
    <Item className={DROPDOWN_MENU_ITEM_CLASS_NAME} data-testid={testId} disabled={disabled} onSelect={handleSelect}>
      {children}
    </Item>
  );
};
