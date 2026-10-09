import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Root } from '@radix-ui/react-dropdown-menu';
import {
  useCallback,
  useState,
} from 'react';

import { DropdownMenuCloseContext } from './DropdownMenuCloseContext';

interface DropdownMenuProps {
  children: ReactNode;
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
  open?: boolean | undefined;
}

export const DropdownMenu = ({ children, onOpenChange, open }: DropdownMenuProps): ReactElement => {
  const [isOpenUncontrolled, setIsOpenUncontrolled] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : isOpenUncontrolled;

  const handleOpenChange = useCallback((nextIsOpen: boolean): void => {
    if (!isControlled) {
      setIsOpenUncontrolled(nextIsOpen);
    }
    onOpenChange?.(nextIsOpen);
  }, [isControlled, onOpenChange]);

  const handleClose = useCallback((): void => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <DropdownMenuCloseContext value={handleClose}>
      <Root modal={false} onOpenChange={handleOpenChange} open={isOpen}>{children}</Root>
    </DropdownMenuCloseContext>
  );
};
