import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);

  return copy;
};

export const encodeEvent = (event: Event): ArrayBuffer => toArrayBuffer(toBinary(EventSchema, event));

export const decodeEvent = (buffer: ArrayBuffer): Event => fromBinary(EventSchema, new Uint8Array(buffer));

export const encodeErrorDetail = (detail: ErrorDetail): ArrayBuffer => toArrayBuffer(toBinary(ErrorDetailSchema, detail));

export const decodeErrorDetail = (buffer: ArrayBuffer): ErrorDetail => fromBinary(ErrorDetailSchema, new Uint8Array(buffer));
