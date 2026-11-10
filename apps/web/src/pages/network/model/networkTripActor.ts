import type { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

export interface NetworkTripActorsValue {
  actors: readonly NetworkTripActorValue[];
  readWorldTimeMs: () => number;
}

export interface NetworkTripActorValue {
  arrivalAtMs: number;
  brandLabel: string;
  brandLogoPath?: string | undefined;
  deliverySiteId: string;
  departureAtMs: number;
  fromNodeId: string;
  id: string;
  phase: 'arrived' | 'loading' | 'moving';
  pickupSiteId: string;
  registrationNumber: string;
  routeLegIds: readonly string[];
  toNodeId: string;
}

export interface NetworkTripListValue {
  rows: readonly NetworkTripRowValue[];
  scene: NetworkTripActorsValue | undefined;
}

export interface NetworkTripRowValue extends NetworkTripActorValue {
  status: TripStatus;
}
