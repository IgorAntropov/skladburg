import type {
  JSHandle,
  Page,
} from '@playwright/test';

interface YardPolicySaveGateValue {
  attempts: number;
  send: (() => void) | undefined;
  status: number | undefined;
}

declare global {
  interface Window {
    __yardPolicySaveGate: undefined | YardPolicySaveGateValue;
  }
}

const holdFirstPolicySave = (): void => {
  const gate: YardPolicySaveGateValue = { attempts: 0, send: undefined, status: undefined };
  window.__yardPolicySaveGate = gate;
  const original: unknown = Reflect.get(Worker.prototype, 'postMessage');
  if (typeof original !== 'function') {
    throw new Error('Worker.postMessage is unavailable');
  }

  Worker.prototype.postMessage = function (
    this: Worker,
    message: unknown,
    transfer?: StructuredSerializeOptions | Transferable[],
  ): void {
    const send = (): void => {
      Reflect.apply(original, this, [message, transfer]);
    };
    if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'request'
      || !('url' in message) || typeof message.url !== 'string'
      || !message.url.endsWith('/wms.v1.YardQueuePolicyService/SaveYardQueuePolicy')
      || !('requestId' in message) || typeof message.requestId !== 'string') {
      send();
      return;
    }
    gate.attempts += 1;
    if (gate.attempts !== 1) {
      send();
      return;
    }
    const { requestId } = message;
    const handleResponse = (event: MessageEvent): void => {
      const reply: unknown = event.data;
      if (typeof reply === 'object' && reply !== null && 'requestId' in reply && reply.requestId === requestId
        && 'type' in reply && reply.type === 'response' && 'status' in reply && typeof reply.status === 'number') {
        gate.status = reply.status;
        this.removeEventListener('message', handleResponse);
      }
    };
    this.addEventListener('message', handleResponse);
    gate.send = send;
  };
};

export const setupYardPolicySaveGate = async (page: Page): Promise<void> => {
  await page.addInitScript(holdFirstPolicySave);
};

export const readYardPolicySaveGate = (page: Page): Promise<JSHandle<YardPolicySaveGateValue>> =>
  page.evaluateHandle((): YardPolicySaveGateValue => {
    if (window.__yardPolicySaveGate === undefined) {
      throw new Error('The policy Save gate was not initialized');
    }
    return window.__yardPolicySaveGate;
  });
export const releaseYardPolicySave = (gate: JSHandle<YardPolicySaveGateValue>): Promise<void> => gate.evaluate((state): void => {
  const send = state.send;
  if (send === undefined) {
    throw new Error('There is no policy Save waiting to be delivered');
  }
  state.send = undefined;
  send();
});
