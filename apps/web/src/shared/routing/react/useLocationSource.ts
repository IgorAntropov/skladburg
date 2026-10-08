import { useContext } from 'react';

import type { ILocationSource } from '../location/locationTypes';

import { RoutingContext } from './RoutingContext';

export const useLocationSource = (): ILocationSource => {
  const location = useContext(RoutingContext);

  if (location === undefined) {
    throw new Error('Routing hooks must be used inside RoutingProvider');
  }

  return location;
};
