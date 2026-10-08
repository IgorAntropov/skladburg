import type { ReactElement } from 'react';

import { Trigger } from '@radix-ui/react-dropdown-menu';

interface DropdownMenuTriggerProps {
  children: ReactElement;
}

export const DropdownMenuTrigger = ({ children }: DropdownMenuTriggerProps): ReactElement => {
  return <Trigger asChild>{children}</Trigger>;
};
