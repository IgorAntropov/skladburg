export interface ILocationSource {
  createHref: (path: string) => string;
  navigate: (path: string, options?: NavigateOptionsValue) => void;
  read: () => LocationSnapshotValue;
  reload: () => void;
  subscribe: (listener: () => void) => () => void;
}

export interface LocationSnapshotValue {
  focusRequest: number;
  path: string;
  searchParams: URLSearchParams;
}

export interface NavigateOptionsValue {
  isFocusRequested?: boolean | undefined;
  isReplace?: boolean | undefined;
}
