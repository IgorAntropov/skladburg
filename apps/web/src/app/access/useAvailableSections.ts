import { useContext } from 'react';

import type { AvailableSectionsValue } from './availableSectionsTypes';

import { AvailableSectionsContext } from './AvailableSectionsContext';

export const useAvailableSections = (): AvailableSectionsValue => {
  const value = useContext(AvailableSectionsContext);

  if (value === undefined) {
    throw new Error('Section hooks must be used inside AvailableSectionsProvider');
  }

  return value;
};
