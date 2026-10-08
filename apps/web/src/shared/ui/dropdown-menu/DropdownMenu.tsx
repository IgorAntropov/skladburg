import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Root } from '@radix-ui/react-dropdown-menu';

interface DropdownMenuProps {
  children: ReactNode;
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
  open?: boolean | undefined;
}

export const DropdownMenu = ({ children, onOpenChange, open }: DropdownMenuProps): ReactElement => {
  return <Root onOpenChange={onOpenChange} open={open}>{children}</Root>;
};
