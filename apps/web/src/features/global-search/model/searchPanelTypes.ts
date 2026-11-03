import type { RefObject } from 'react';

import type { AppAddressValue } from '@/shared/routing';

export interface SearchControllerProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onFieldExit: () => void;
  onPendingChooseConsumed: () => void;
  onPhoneFieldClose: () => void;
  onQueryReset: () => void;
  organizationId: string | undefined;
  pendingChooseQuery: string | undefined;
  query: string;
  rootRef: RefObject<HTMLElement | null>;
}

export interface SearchPanelCommandsValue {
  choose: () => void;
  move: (step: -1 | 1) => void;
}

export interface SearchPanelProps {
  commandsRef: RefObject<null | SearchPanelCommandsValue>;
  listboxId: string;
  onActiveOptionChange: (optionDomId: string | undefined) => void;
  onChoose: (address: AppAddressValue) => void;
  onDismiss: () => void;
  onPendingChooseSettled: () => void;
  organizationId: string | undefined;
  pendingChooseQuery: string | undefined;
  query: string;
  rootRef: RefObject<HTMLElement | null>;
}
