import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Label } from '@radix-ui/react-dropdown-menu';

import { DROPDOWN_MENU_LABEL_CLASS_NAME } from './dropdownMenuStyles';

interface DropdownMenuLabelProps {
  children: ReactNode;
}

export const DropdownMenuLabel = ({ children }: DropdownMenuLabelProps): ReactElement => {
  return <Label className={DROPDOWN_MENU_LABEL_CLASS_NAME}>{children}</Label>;
};
