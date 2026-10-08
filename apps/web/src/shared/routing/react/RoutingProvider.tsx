import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { ILocationSource } from '../location/locationTypes';

import { RoutingContext } from './RoutingContext';

interface RoutingProviderProps {
  children: ReactNode;
  location: ILocationSource;
}

export const RoutingProvider = ({ children, location }: RoutingProviderProps): ReactElement => {
  return <RoutingContext value={location}>{children}</RoutingContext>;
};
