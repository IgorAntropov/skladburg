import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);

  return copy;
};

export const encodeErrorDetail = (detail: ErrorDetail): ArrayBuffer => toArrayBuffer(toBinary(ErrorDetailSchema, detail));

export const decodeErrorDetail = (buffer: ArrayBuffer): ErrorDetail => fromBinary(ErrorDetailSchema, new Uint8Array(buffer));
