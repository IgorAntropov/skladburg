import type { ReactElement } from 'react';

import { Separator } from '@radix-ui/react-dropdown-menu';

import { DROPDOWN_MENU_SEPARATOR_CLASS_NAME } from './dropdownMenuStyles';

export const DropdownMenuSeparator = (): ReactElement => {
  return <Separator className={DROPDOWN_MENU_SEPARATOR_CLASS_NAME} />;
};
