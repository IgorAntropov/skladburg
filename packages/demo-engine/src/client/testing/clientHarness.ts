import type { Client } from '@connectrpc/connect';

import {
  createClient,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { EngineConnectionOptionsValue } from '../types';
import type { IEngineConnection } from '../types';
import type { EngineHostStubValue } from './engineHostStub';

import { ENGINE_BASE_URL } from '../../protocol/index';
import { connectToEngine } from '../connectToEngine';
import { createEngineHostStub } from './engineHostStub';

export interface ClientHarnessValue {
  close: () => void;
  connection: IEngineConnection;
  createOrganizationClient: (useBinaryFormat: boolean) => Client<typeof OrganizationService>;
  stub: EngineHostStubValue;
}

const openHarnesses: ClientHarnessValue[] = [];

export const createClientHarness = async (options?: EngineConnectionOptionsValue): Promise<ClientHarnessValue> => {
  const { port1, port2 } = new MessageChannel();
  const stub = await createEngineHostStub(port2);
  const connection = connectToEngine(port1, options);

  const createTransport = (useBinaryFormat: boolean): Transport => createConnectTransport({
    baseUrl: ENGINE_BASE_URL,
    fetch: connection.fetch,
    useBinaryFormat,
  });

  const harness: ClientHarnessValue = {
    close: () => {
      connection.close();
      stub.close();
      port1.close();
    },
    connection,
    createOrganizationClient: useBinaryFormat => createClient(OrganizationService, createTransport(useBinaryFormat)),
    stub,
  };

  openHarnesses.push(harness);

  return harness;
};

export const closeClientHarnesses = (): void => {
  for (const harness of openHarnesses.splice(0)) {
    harness.close();
  }
};
