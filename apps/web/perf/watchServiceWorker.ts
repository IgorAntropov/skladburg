import type {
  Browser,
  CDPSession,
} from '@playwright/test';

import type {
  NetworkConditionsValue,
  RequestValue,
  ServiceWorkerThrottlingValue,
} from './perfTypes.ts';
import type { IWorkerChannel } from './workerChannel.ts';

import { createPreparationTracker } from './createPreparationTracker.ts';
import { createRequestRecorder } from './createRequestRecorder.ts';
import { judgeServiceWorkerThrottling } from './judgeServiceWorkerThrottling.ts';
import { routeNetworkEvent } from './routeNetworkEvent.ts';
import { createWorkerChannel } from './workerChannel.ts';

export interface IServiceWorkerWatch {
  collectRequests: (timeOriginMs: number) => RequestValue[];
  detach: () => Promise<void>;
  readThrottling: () => Promise<ServiceWorkerThrottlingValue>;
}

export interface WatchServiceWorkerInputValue {
  browser: Browser;
  contextId: string | undefined;
  network: NetworkConditionsValue;
}

const PREPARATION_TIMEOUT_MS = 1000;

const prepareServiceWorker = async (channel: IWorkerChannel, network: NetworkConditionsValue): Promise<void> => {
  await channel.send('Network.enable');
  await channel.send('Network.emulateNetworkConditions', {
    downloadThroughput: network.downloadBytesPerSecond,
    latency: network.latencyMs,
    offline: false,
    uploadThroughput: network.uploadBytesPerSecond,
  });
};

export const watchServiceWorker = async ({
  browser,
  contextId,
  network,
}: WatchServiceWorkerInputValue): Promise<IServiceWorkerWatch> => {
  const session: CDPSession = await browser.newBrowserCDPSession();
  const recorder = createRequestRecorder('service-worker');
  const channelsBySessionId = new Map<string, IWorkerChannel>();
  const tracker = createPreparationTracker();

  session.on('Target.receivedMessageFromTarget', ({ message, sessionId }) => {
    channelsBySessionId.get(sessionId)?.handleIncoming(message);
  });

  session.on('Target.attachedToTarget', ({ sessionId, targetInfo }) => {
    const channel = createWorkerChannel(session, sessionId);

    channelsBySessionId.set(sessionId, channel);

    channel.onEvent((method, params) => {
      routeNetworkEvent(recorder, method, params);
    });

    prepareServiceWorker(channel, network)
      .then(() => {
        tracker.settle(targetInfo.targetId, 'applied');
      })
      .catch((error: unknown) => {
        console.log('> watchServiceWorker -> prepareServiceWorker:', { error: String(error) });
        tracker.settle(targetInfo.targetId, 'refused');
      });
  });

  session.on('Target.targetCreated', ({ targetInfo }) => {
    const isOwnServiceWorker = targetInfo.type === 'service_worker'
      && (contextId === undefined || targetInfo.browserContextId === contextId);

    if (isOwnServiceWorker && tracker.begin(targetInfo.targetId)) {
      session.send('Target.attachToTarget', { flatten: false, targetId: targetInfo.targetId }).catch((error: unknown) => {
        console.log('> watchServiceWorker -> attachToTarget:', { error: String(error) });
        tracker.settle(targetInfo.targetId, 'refused');
      });
    }
  });

  await session.send('Target.setDiscoverTargets', { discover: true });

  return {
    collectRequests(timeOriginMs: number): RequestValue[] {
      return recorder.toRequests(timeOriginMs);
    },
    async detach(): Promise<void> {
      await session.detach().catch((error: unknown) => {
        console.log('> watchServiceWorker -> detach:', { error: String(error) });
      });
    },
    async readThrottling(): Promise<ServiceWorkerThrottlingValue> {
      await tracker.waitForSettled(PREPARATION_TIMEOUT_MS);

      return judgeServiceWorkerThrottling({ network, outcomes: tracker.outcomes(), requests: recorder.toRequests(0) });
    },
  };
};
