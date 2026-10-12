import type { QueryClient } from '@tanstack/react-query';

import type {
  ActingContextValue,
  IActingContextStore,
} from '../context/actingContextTypes';

export interface ReplaceActingContextOptionsValue {
  actingContext: IActingContextStore;
  context: ActingContextValue;
  queryClient: QueryClient;
}

export const replaceActingContext = async (options: ReplaceActingContextOptionsValue): Promise<void> => {
  const { actingContext, context, queryClient } = options;

  await queryClient.cancelQueries();
  actingContext.set(context);
  queryClient.clear();
};
