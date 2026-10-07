import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';

import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';

import type { IDomainErrors } from '../errors/index';
import type { IStateTransaction } from '../state/index';

export interface IdempotentRunOptionsValue<TInput extends DescMessage, TOutput extends DescMessage> {
  handler: () => MessageShape<TOutput>;
  idempotencyKey: string;
  method: DescMethodUnary<TInput, TOutput>;
  request: MessageShape<TInput>;
  scope: string;
}

export interface IIdempotencyGuard {
  run: <TInput extends DescMessage, TOutput extends DescMessage>(
    transaction: IStateTransaction,
    options: IdempotentRunOptionsValue<TInput, TOutput>,
  ) => MessageShape<TOutput>;
}

const KEY_SEPARATOR = ':';
const METHOD_SEPARATOR = '/';

const areBytesEqual = (current: Uint8Array, next: Uint8Array): boolean =>
  current.length === next.length && current.every((byte, position) => byte === next[position]);

export const getMethodName = (method: DescMethodUnary): string =>
  `${method.parent.typeName}${METHOD_SEPARATOR}${method.name}`;

export const buildIdempotencyRecordId = (scope: string, methodName: string, idempotencyKey: string): string =>
  [scope, methodName, idempotencyKey].join(KEY_SEPARATOR);

export const createIdempotencyGuard = (errors: IDomainErrors): IIdempotencyGuard => ({
  run: (transaction, options) => {
    const methodName = getMethodName(options.method);
    const id = buildIdempotencyRecordId(options.scope, methodName, options.idempotencyKey);
    const requestBytes = toBinary(options.method.input, options.request);
    const stored = transaction.get('idempotency', id);

    if (stored !== undefined) {
      if (!areBytesEqual(stored.requestBytes, requestBytes)) {
        throw errors.idempotencyKeyReused();
      }

      return fromBinary(options.method.output, stored.responseBytes);
    }

    const response = options.handler();
    transaction.put('idempotency', {
      id,
      method: methodName,
      requestBytes,
      responseBytes: toBinary(options.method.output, response),
    });

    return response;
  },
});
