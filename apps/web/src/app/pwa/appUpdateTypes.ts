export type AppUpdateStateValue = 'applying' | 'dismissed' | 'idle' | 'ready' | 'reloadRequired';

export interface AppUpdateStoreOptionsValue {
  isServiceWorkerSupported: boolean;
  reloadPage: () => void;
  visibility: IVisibilitySource;
}

export interface IAppUpdateSource {
  apply: () => void;
  dismiss: () => void;
  getState: () => AppUpdateStateValue;
  subscribe: (listener: () => void) => () => void;
}

export interface IAppUpdateStore extends IAppUpdateSource {
  connect: (register: RegisterServiceWorkerFunction) => void;
  release: () => void;
}

export interface IUpdatableRegistration {
  update: () => Promise<unknown>;
}

export interface IVisibilitySource {
  addEventListener: (type: 'visibilitychange', listener: () => void) => void;
  removeEventListener: (type: 'visibilitychange', listener: () => void) => void;
  readonly visibilityState: DocumentVisibilityState;
}

export type RegisterServiceWorkerFunction = (
  options: ServiceWorkerRegistrationOptionsValue,
) => (shouldReloadPage?: boolean) => Promise<void>;

export interface ServiceWorkerRegistrationOptionsValue {
  immediate: boolean;
  onNeedRefresh: () => void;
  onNeedReload: () => void;
  onRegisteredSW: (scriptUrl: string, registration: IUpdatableRegistration | undefined) => void;
  onRegisterError: (error: unknown) => void;
}
