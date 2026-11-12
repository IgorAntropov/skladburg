import { fromBinary } from '@bufbuild/protobuf';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';

export const decodeEvent = (buffer: ArrayBuffer): Event => fromBinary(EventSchema, new Uint8Array(buffer));
