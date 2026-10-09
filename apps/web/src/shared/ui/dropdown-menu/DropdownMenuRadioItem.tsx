import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  ItemIndicator,
  RadioItem,
} from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

import {
  DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME,
  DROPDOWN_MENU_INDICATOR_SLOT_END_CLASS_NAME,
  DROPDOWN_MENU_ITEM_CLASS_NAME,
} from './dropdownMenuStyles';

interface DropdownMenuRadioItemProps {
  children: ReactNode;
  disabled?: boolean | undefined;
  indicatorPlacement?: 'end' | 'start' | undefined;
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
  const isIndicatorAtEnd = indicatorPlacement === 'end';

  const indicator = (
    <span className={cn(DROPDOWN_MENU_INDICATOR_SLOT_CLASS_NAME, isIndicatorAtEnd && DROPDOWN_MENU_INDICATOR_SLOT_END_CLASS_NAME)}>
      <ItemIndicator>
        <Check aria-hidden className="size-4" />
      </ItemIndicator>
    </span>
  );

  return (
    <RadioItem aria-label={label} className={DROPDOWN_MENU_ITEM_CLASS_NAME} disabled={disabled} value={value}>
      {isIndicatorAtEnd ? null : indicator}
      {children}
      {isIndicatorAtEnd ? indicator : null}
    </RadioItem>
  );
};
