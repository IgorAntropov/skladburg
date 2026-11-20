import type {
  ActingContextValue,
  IActingContextStore,
} from './actingContextTypes';

export const ACTING_CONTEXT_STORAGE_KEY = 'acting-context';

const isFilledString = (value: unknown): value is string => typeof value === 'string' && value !== '';

export const getTabStorage = (target: Window): Storage | undefined => {
  try {
    return target.sessionStorage;
  }
  catch (error: unknown) {
    console.log('> actingContextPersistence -> getTabStorage:', { error });

    return undefined;
  }
};

export const readPersistedActingContext = (
  storage: Storage | undefined,
  key: string = ACTING_CONTEXT_STORAGE_KEY,
): ActingContextValue | undefined => {
  if (storage === undefined) {
    return undefined;
  }

  try {
    const raw = storage.getItem(key);

    if (raw === null) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    const organizationId = 'organizationId' in parsed ? parsed.organizationId : undefined;
    const userId = 'userId' in parsed ? parsed.userId : undefined;

    if (!isFilledString(organizationId) || !isFilledString(userId)) {
      return undefined;
    }

    return { organizationId, userId };
  }
  catch (error: unknown) {
    console.log('> actingContextPersistence -> readPersistedActingContext:', { error });

    return undefined;
  }
};

export const writePersistedActingContext = (
  storage: Storage | undefined,
  context: ActingContextValue,
  key: string = ACTING_CONTEXT_STORAGE_KEY,
): void => {
  if (storage === undefined) {
    return;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({ organizationId: context.organizationId, userId: context.userId }),
    );
  }
  catch (error: unknown) {
    console.log('> actingContextPersistence -> writePersistedActingContext:', { error });
  }
};

export const persistActingContext = (store: IActingContextStore, storage: Storage | undefined, key?: string): () => void => {
  writePersistedActingContext(storage, store.get(), key);

  return store.subscribe(() => {
    writePersistedActingContext(storage, store.get(), key);
  });
};
