import {
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react';

import { useFocusHandoff } from '@/shared/ui';

import { ORGANIZATION_DIRECTORY_TABLE_FOCUS_KEY } from './organizationDirectoryTableFocusKey';

export interface OrganizationDirectoryTableValue {
  close: () => void;
  isOpen: boolean;
  open: () => void;
  panelId: string;
}

export const useOrganizationDirectoryTable = (): OrganizationDirectoryTableValue => {
  const { requestFocus } = useFocusHandoff<HTMLButtonElement>(ORGANIZATION_DIRECTORY_TABLE_FOCUS_KEY);
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((): void => {
    console.log('> useOrganizationDirectoryTable -> open:', {});
    setIsOpen(true);
  }, []);

  const close = useCallback((): void => {
    console.log('> useOrganizationDirectoryTable -> close:', {});
    requestFocus();
    setIsOpen(false);
  }, [requestFocus]);

  return useMemo(() => ({ close, isOpen, open, panelId }), [close, isOpen, open, panelId]);
};
