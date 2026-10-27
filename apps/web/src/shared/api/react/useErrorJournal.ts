import type { IErrorJournal } from '../errors/errorJournal';

import { useApiRuntime } from './useApiRuntime';

export const useErrorJournal = (): IErrorJournal => {
  return useApiRuntime().errorJournal;
};
