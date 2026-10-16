import type {
  Browser,
  CDPSession,
} from '@playwright/test';

import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';
import type { IWorkerChannel } from './workerChannel.ts';

import { createRequestRecorder } from './createRequestRecorder.ts';
import { routeNetworkEvent } from './routeNetworkEvent.ts';
import { createWorkerChannel } from './workerChannel.ts';

export interface IServiceWorkerWatch {
  collectRequests: (timeOriginMs: number) => RequestValue[];
  detach: () => Promise<void>;
  readThrottling: () => boolean | null;
}

export interface WatchServiceWorkerInputValue {
  browser: Browser;
  contextId: string | undefined;
  network: NetworkConditionsValue;
}

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
  const knownTargetIds = new Set<string>();
  let attachedCount = 0;
  let appliedCount = 0;

  session.on('Target.receivedMessageFromTarget', ({ message, sessionId }) => {
    channelsBySessionId.get(sessionId)?.handleIncoming(message);
  });

  session.on('Target.attachedToTarget', ({ sessionId }) => {
    const channel = createWorkerChannel(session, sessionId);

    channelsBySessionId.set(sessionId, channel);
    attachedCount += 1;

    channel.onEvent((method, params) => {
      routeNetworkEvent(recorder, method, params);
    });

    prepareServiceWorker(channel, network)
      .then(() => {
        appliedCount += 1;
      })
      .catch((error: unknown) => {
        console.log('> watchServiceWorker -> prepareServiceWorker:', { error: String(error) });
      });
  });

  session.on('Target.targetCreated', ({ targetInfo }) => {
    const isOwnServiceWorker = targetInfo.type === 'service_worker'
      && (contextId === undefined || targetInfo.browserContextId === contextId);

    if (isOwnServiceWorker && !knownTargetIds.has(targetInfo.targetId)) {
      knownTargetIds.add(targetInfo.targetId);
      session.send('Target.attachToTarget', { flatten: false, targetId: targetInfo.targetId }).catch((error: unknown) => {
        console.log('> watchServiceWorker -> attachToTarget:', { error: String(error) });
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
    readThrottling(): boolean | null {
      return attachedCount === 0 ? null : appliedCount === attachedCount;
    },
  };
};
