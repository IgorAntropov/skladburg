import type {
  PrintCodeResponseValue,
  PrintCodeValue,
} from './printCodeTypes';

import { encodePrintCodes } from './encodePrintCodes';

const handleMessage = (event: MessageEvent<readonly PrintCodeValue[]>): void => {
  let response: PrintCodeResponseValue;
  try {
    response = { codes: encodePrintCodes(event.data), kind: 'ready' };
  }
  catch {
    response = { kind: 'failed' };
  }
  self.postMessage(response);
};

self.addEventListener('message', handleMessage);
