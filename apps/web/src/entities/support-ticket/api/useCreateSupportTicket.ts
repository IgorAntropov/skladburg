import type {
  CreateSupportTicketResponse,
  SupportTicketCategory,
  SupportTicketContext,
} from '@skladburg/contracts/support/v1/support_ticket';

import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { CommandValue } from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import { supportTicketKeys } from './supportTicketKeys';

export interface UseCreateSupportTicketOptionsValue {
  category: SupportTicketCategory | undefined;
  context: SupportTicketContext | undefined;
  onSuccess?: ((response: CreateSupportTicketResponse) => void) | undefined;
}

export const useCreateSupportTicket = ({
  category,
  context,
  onSuccess,
}: UseCreateSupportTicketOptionsValue): CommandValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  const execute = async (idempotencyKey: string): Promise<CreateSupportTicketResponse> => {
    if (category === undefined || context === undefined) {
      throw new TypeError('The category and the context of a support ticket are required');
    }

    const response = await client.service(SupportTicketService).createSupportTicket({
      category,
      context,
      idempotencyKey,
    });

    await queryClient.invalidateQueries({ queryKey: supportTicketKeys.all });

    return response;
  };

  const command = useCommand({
    execute,
    method: SupportTicketService.method.createSupportTicket,
    onSuccess,
  });

  const { reset } = command;

  useEffect(() => {
    reset();
  }, [category, context, reset]);

  return command;
};
