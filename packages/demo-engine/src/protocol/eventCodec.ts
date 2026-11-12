import { toBinary } from '@bufbuild/protobuf';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';

import { toArrayBuffer } from './codecs';

export const encodeEvent = (event: Event): ArrayBuffer => toArrayBuffer(toBinary(EventSchema, event));
