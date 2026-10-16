import type {
  BrowserContext,
  CDPSession,
  Page,
} from '@playwright/test';

import type { OpenRequestValue } from './createRequestRecorder.ts';
import type {
  PerfProfileValue,
  RequestValue,
  ServiceWorkerThrottlingValue,
} from './perfTypes.ts';
import type { IServiceWorkerWatch } from './watchServiceWorker.ts';
import type { IWorkerChannel } from './workerChannel.ts';

import { createRequestRecorder } from './createRequestRecorder.ts';
import { routeNetworkEvent } from './routeNetworkEvent.ts';
import { watchServiceWorker } from './watchServiceWorker.ts';
import { createWorkerChannel } from './workerChannel.ts';

export interface IEmulation {
  collectOpenRequests: (timeOriginMs: number) => OpenRequestValue[];
  collectRequests: (timeOriginMs: number) => RequestValue[];
  detach: () => Promise<void>;
  readServiceWorkerThrottling: () => Promise<ServiceWorkerThrottlingValue>;
}

const prepareWorker = async (channel: IWorkerChannel): Promise<void> => {
  try {
    await channel.send('Network.enable');
  }
  finally {
    await channel.send('Runtime.runIfWaitingForDebugger');
  }
};

export const startEmulation = async (
  context: BrowserContext,
  page: Page,
  profile: PerfProfileValue,
): Promise<IEmulation> => {
  const session: CDPSession = await context.newCDPSession(page);
  const pageRecorder = createRequestRecorder('page');
  const workerRecorder = createRequestRecorder('worker');
  const channelsBySessionId = new Map<string, IWorkerChannel>();
  const { targetInfo: pageTargetInfo } = await session.send('Target.getTargetInfo');
  const browser = context.browser();
  const serviceWorkerWatch: IServiceWorkerWatch | undefined = browser === null
    ? undefined
    : await watchServiceWorker({ browser, contextId: pageTargetInfo.browserContextId, network: profile.network });

  session.on('event', ({ method, params }) => {
    routeNetworkEvent(pageRecorder, method, params);
  });

  session.on('Target.receivedMessageFromTarget', ({ message, sessionId }) => {
    channelsBySessionId.get(sessionId)?.handleIncoming(message);
  });

  session.on('Target.attachedToTarget', ({ sessionId, targetInfo }) => {
    const channel = createWorkerChannel(session, sessionId);

    channelsBySessionId.set(sessionId, channel);

    if (targetInfo.type === 'worker') {
      channel.onEvent((method, eventParams) => {
        routeNetworkEvent(workerRecorder, method, eventParams);
      });
      prepareWorker(channel).catch((error: unknown) => {
        console.log('> startEmulation -> prepareWorker:', { error: String(error) });
      });
    }
    else {
      channel.send('Runtime.runIfWaitingForDebugger').catch((error: unknown) => {
        console.log('> startEmulation -> resumeTarget:', { error: String(error), type: targetInfo.type });
      });
    }
  });

  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    downloadThroughput: profile.network.downloadBytesPerSecond,
    latency: profile.network.latencyMs,
    offline: false,
    uploadThroughput: profile.network.uploadBytesPerSecond,
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
  await session.send('Target.setAutoAttach', { autoAttach: true, flatten: false, waitForDebuggerOnStart: true });

  return {
    collectOpenRequests(timeOriginMs: number): OpenRequestValue[] {
      return [...pageRecorder.toOpenRequests(timeOriginMs), ...workerRecorder.toOpenRequests(timeOriginMs)];
    },
    collectRequests(timeOriginMs: number): RequestValue[] {
      return [
        ...pageRecorder.toRequests(timeOriginMs),
        ...workerRecorder.toRequests(timeOriginMs),
        ...(serviceWorkerWatch?.collectRequests(timeOriginMs) ?? []),
      ].sort((first, second) => first.startAt - second.startAt);
    },
    async detach(): Promise<void> {
      await session.detach().catch((error: unknown) => {
        console.log('> startEmulation -> detach:', { error: String(error) });
      });
      await serviceWorkerWatch?.detach();
    },
    async readServiceWorkerThrottling(): Promise<ServiceWorkerThrottlingValue> {
      return await serviceWorkerWatch?.readThrottling() ?? { isThrottled: null, note: 'absent' };
    },
  };
};
