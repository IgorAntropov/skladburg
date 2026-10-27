import type { DescMethod } from '@bufbuild/protobuf';
import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { ListNotificationsResponse } from '@skladburg/contracts/notification/v1/notification';

import { timestampNow } from '@bufbuild/protobuf/wkt';
import { useQueryClient } from '@tanstack/react-query';

import type {
  ApiClient,
  CommandValue,
} from '@/shared/api';

import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import { notificationKeys } from './notificationKeys';

export interface ReadCommandOptionsValue {
  applyRead: (response: ListNotificationsResponse, readAt: Timestamp) => ListNotificationsResponse;
  method: DescMethod;
  onSuccess?: (() => void) | undefined;
  send: (client: ApiClient, idempotencyKey: string) => Promise<unknown>;
}

export const useReadCommand = ({
  applyRead,
  method,
  onSuccess,
  send,
}: ReadCommandOptionsValue): CommandValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId } = useActingContext();
  const listKey = notificationKeys.list(getOrganizationScope(organizationId));

  const execute = async (idempotencyKey: string): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: listKey });

    const previous = queryClient.getQueryData<ListNotificationsResponse>(listKey);

    if (previous !== undefined) {
      queryClient.setQueryData<ListNotificationsResponse>(listKey, applyRead(previous, timestampNow()));
    }

    try {
      await send(client, idempotencyKey);
    }
    catch (error) {
      console.log('> useReadCommand -> execute:', { error, method: method.name });

      if (previous !== undefined) {
        queryClient.setQueryData<ListNotificationsResponse>(listKey, previous);
      }

      throw error;
    }
    finally {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    }
  };

  return useCommand({
    execute,
    method,
    onSuccess,
  });
};
