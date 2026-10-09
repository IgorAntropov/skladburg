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
  indicatorPlacement?: 'none' | 'start' | undefined;
  label?: string | undefined;
  value: string;
}

export const DropdownMenuRadioItem = ({
  children,
  disabled,
  indicatorPlacement = 'start',
  label,
  value,
}: DropdownMenuRadioItemProps): ReactElement => {
  const isIndicatorShown = indicatorPlacement !== 'none';

  return (
    <RadioItem aria-label={label} className={DROPDOWN_MENU_ITEM_CLASS_NAME} disabled={disabled} value={value}>
      {isIndicatorShown && (
        <span className={DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME}>
          <ItemIndicator>
            <Check aria-hidden className="size-4" />
          </ItemIndicator>
        </span>
      )}
      {children}
    </RadioItem>
  );
};
