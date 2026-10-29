import type { QueryClient } from '@tanstack/react-query';

import type {
  ActingContextValue,
  IActingContextStore,
} from '../context/actingContextTypes';
import type { IErrorJournal } from '../errors/errorJournal';

export interface ReplaceActingContextOptionsValue {
  actingContext: IActingContextStore;
  context: ActingContextValue;
  errorJournal: IErrorJournal;
  queryClient: QueryClient;
}

export const replaceActingContext = async (options: ReplaceActingContextOptionsValue): Promise<void> => {
  const {
    actingContext,
    context,
    errorJournal,
    queryClient,
  } = options;

  await queryClient.cancelQueries();
  actingContext.set(context);
  queryClient.clear();
  errorJournal.clear();
};
