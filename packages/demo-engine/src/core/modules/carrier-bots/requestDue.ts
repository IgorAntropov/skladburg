import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

export const CARRIER_BOT_RESPONSE_DELAY_MS = 60_000;

export const isCarrierBotRequestDue = (request: TransportRequestRecord, nowMs: number): boolean =>
  request.status === TransportRequestStatus.OPEN && request.publishedAt !== undefined
  && nowMs - timestampMs(request.publishedAt) >= CARRIER_BOT_RESPONSE_DELAY_MS;
