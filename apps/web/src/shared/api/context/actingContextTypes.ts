export interface ActingContextValue {
  organizationId: string | undefined;
  userId: string | undefined;
}

export interface IActingContextStore {
  get: () => ActingContextValue;
  set: (context: ActingContextValue) => void;
  subscribe: (listener: () => void) => () => void;
}
