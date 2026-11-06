import type { Client } from '@connectrpc/connect';
import type { Page } from '@playwright/test';

import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { DocumentService } from '@skladburg/contracts/document/v1/document';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';

import type {
  EngineWorkerRobotValue,
  WorkerActingContextValue,
} from './engine-worker-robot.ts';

import { createEngineWorkerRobot } from './engine-worker-robot.ts';

export const DEAL_CUSTOMER: WorkerActingContextValue = {
  organizationId: '10000001-0000-4000-8000-000000000000',
  userId: '20000001-0000-4000-8000-000000000000',
};

export const DEAL_SUPPLIER: WorkerActingContextValue = {
  organizationId: '10000002-0000-4000-8000-000000000000',
  userId: '20000002-0000-4000-8000-000000000000',
};

export interface DealWorkerRobotValue extends EngineWorkerRobotValue {
  deals: Client<typeof DealService>;
  documents: Client<typeof DocumentService>;
  notifications: Client<typeof NotificationService>;
  showcase: Client<typeof ShowcaseService>;
}

export const createDealWorkerRobot = async (
  page: Page,
  actingContext: WorkerActingContextValue,
): Promise<DealWorkerRobotValue> => {
  const worker = await createEngineWorkerRobot(page, actingContext);
  const transport = createConnectTransport({
    baseUrl: 'https://demo-engine.invalid',
    fetch: async (input, init): Promise<Response> => {
      const request = new Request(input, init);
      const response = await worker.request(new URL(request.url).pathname.slice(1), new Uint8Array(await request.arrayBuffer()));
      return new Response(Uint8Array.from(response.body).buffer, { headers: response.headers, status: response.status });
    },
    useBinaryFormat: true,
  });

  return {
    ...worker,
    deals: createClient(DealService, transport),
    documents: createClient(DocumentService, transport),
    notifications: createClient(NotificationService, transport),
    showcase: createClient(ShowcaseService, transport),
  };
};
