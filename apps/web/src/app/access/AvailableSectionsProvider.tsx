import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { AvailableSectionsValue } from './availableSectionsTypes';

import { AvailableSectionsContext } from './AvailableSectionsContext';

interface AvailableSectionsProviderProps {
  children: ReactNode;
  value: AvailableSectionsValue;
}

export const AvailableSectionsProvider = ({ children, value }: AvailableSectionsProviderProps): ReactElement => {
  return <AvailableSectionsContext value={value}>{children}</AvailableSectionsContext>;
};
