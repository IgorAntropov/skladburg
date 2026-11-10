import type { TransportOffer } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IStateReader } from '../../state/index';

export const readOwnTransportOffer = (read: IStateReader, requestId: string, organizationId: string): TransportOffer | undefined =>
  read.listBy('transportOffers', 'transportRequestId', requestId).find(offer => offer.carrierOrganizationId === organizationId);
