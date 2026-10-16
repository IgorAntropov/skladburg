import type { IRequestRecorder } from './createRequestRecorder.ts';

interface LoadingFinishedParamsValue {
  encodedDataLength: number;
  requestId: string;
  timestamp: number;
}

interface RequestIdParamsValue {
  requestId: string;
}

interface RequestWillBeSentParamsValue {
  request: { url: string };
  requestId: string;
  timestamp: number;
  wallTime: number;
}

interface ResponseReceivedParamsValue {
  requestId: string;
  response: { fromDiskCache?: boolean; fromPrefetchCache?: boolean; fromServiceWorker?: boolean };
}

export const routeNetworkEvent = (recorder: IRequestRecorder, method: string, params: unknown): void => {
  switch (method) {
    case 'Network.loadingFailed': {
      recorder.fail((params as RequestIdParamsValue).requestId);
      break;
    }
    case 'Network.loadingFinished': {
      const { encodedDataLength, requestId, timestamp } = params as LoadingFinishedParamsValue;

      recorder.finish({ encodedDataLength, requestId, timestamp });
      break;
    }
    case 'Network.requestServedFromCache': {
      recorder.markServedFromCache((params as RequestIdParamsValue).requestId);
      break;
    }
    case 'Network.requestWillBeSent': {
      const { request, requestId, timestamp, wallTime } = params as RequestWillBeSentParamsValue;

      recorder.start({ requestId, timestamp, url: request.url, wallTime });
      break;
    }
    case 'Network.responseReceived': {
      const { requestId, response } = params as ResponseReceivedParamsValue;
      const isFromCache = response.fromDiskCache === true
        || response.fromServiceWorker === true
        || response.fromPrefetchCache === true;

      recorder.respond({ isFromCache, requestId });
      break;
    }
    default:
  }
};
