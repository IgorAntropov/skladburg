import type { ILocationSource } from '../location/locationTypes';

import { useLocationSource } from './useLocationSource';

export const useRequestLeave = (): ILocationSource['requestLeave'] => useLocationSource().requestLeave;
