import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  ItemIndicator,
  RadioItem,
} from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import {
  DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME,
  DROPDOWN_MENU_ITEM_CLASS_NAME,
} from './dropdownMenuStyles';

interface DropdownMenuRadioItemProps {
  children: ReactNode;
  disabled?: boolean | undefined;
  value: string;
}

export const DropdownMenuRadioItem = ({ children, disabled, value }: DropdownMenuRadioItemProps): ReactElement => {
  return (
    <RadioItem className={DROPDOWN_MENU_ITEM_CLASS_NAME} disabled={disabled} value={value}>
      <span className={DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME}>
        <ItemIndicator>
          <Check aria-hidden className="size-4" />
        </ItemIndicator>
      </span>
      {children}
    </RadioItem>
  );
};
