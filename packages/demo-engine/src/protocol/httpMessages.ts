import type {
  EngineRequestMessageValue,
  EngineResponseMessageValue,
  HeaderPairValue,
} from './messages';

export interface TransferableMessageValue<TMessage> {
  message: TMessage;
  transfer: ArrayBuffer[];
}

const readHeaderPairs = (headers: Headers): HeaderPairValue[] => Array.from(headers.entries());

const toBodyInit = (body: ArrayBuffer): ArrayBuffer | null => body.byteLength === 0 ? null : body;

export const serializeRequest = async (
  request: Request,
  requestId: string,
): Promise<TransferableMessageValue<EngineRequestMessageValue>> => {
  const body = await request.arrayBuffer();

  return {
    message: {
      body,
      headers: readHeaderPairs(request.headers),
      method: request.method,
      requestId,
      type: 'request',
      url: request.url,
    },
    transfer: [body],
  };
};

export const restoreRequest = (message: EngineRequestMessageValue): Request => {
  const hasBody = message.method !== 'GET' && message.method !== 'HEAD';

  return new Request(message.url, {
    body: hasBody ? toBodyInit(message.body) : null,
    headers: message.headers,
    method: message.method,
  });
};

export const serializeResponse = async (
  response: Response,
  requestId: string,
): Promise<TransferableMessageValue<EngineResponseMessageValue>> => {
  const body = await response.arrayBuffer();

  return {
    message: {
      body,
      headers: readHeaderPairs(response.headers),
      requestId,
      status: response.status,
      type: 'response',
    },
    transfer: [body],
  };
};

export const restoreResponse = (message: EngineResponseMessageValue): Response =>
  new Response(toBodyInit(message.body), {
    headers: message.headers,
    status: message.status,
  });
