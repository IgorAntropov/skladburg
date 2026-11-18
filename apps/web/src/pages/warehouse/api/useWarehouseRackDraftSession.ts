import { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import {
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import { useApiClient } from '@/shared/api';

import { createWarehouseRackDraftSession } from './warehouseRackDraftSession';

type WarehouseRackDraftSessionValue = ReturnType<typeof createWarehouseRackDraftSession>;

interface WarehouseRackDraftValue {
  session: WarehouseRackDraftSessionValue;
  state: ReturnType<WarehouseRackDraftSessionValue['read']>;
}

export const useWarehouseRackDraftSession = (): WarehouseRackDraftValue => {
  const client = useApiClient();
  const [session] = useState(() => createWarehouseRackDraftSession(client.service(WarehouseLayoutSessionService)));
  const state = useSyncExternalStore(session.subscribe, session.read);

  useEffect(() => (): void => {
    void session.release();
  }, [session]);

  return { session, state };
};
