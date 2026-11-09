import type { ReactElement } from 'react';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';

import type { AppAddressValue } from '@/shared/routing';

import { useNavigate } from '@/shared/routing';

import type {
  SearchControllerProps,
  SearchPanelCommandsValue,
} from '../../model/searchPanelTypes';
import type { SearchFieldStateValue } from './searchFieldReducer';

import { GlobalSearchPanel } from './GlobalSearchPanel';
import {
  getEnterOutcome,
  INITIAL_SEARCH_FIELD_STATE,
  searchFieldReducer,
} from './searchFieldReducer';

const createInitialState = (pendingChooseQuery: string | undefined): SearchFieldStateValue => ({
  ...INITIAL_SEARCH_FIELD_STATE,
  isPanelOpen: pendingChooseQuery !== undefined,
  pendingChooseQuery,
});

export const SearchController = ({
  inputRef,
  onFieldExit,
  onPendingChooseConsumed,
  onPhoneFieldClose,
  onQueryReset,
  organizationId,
  pendingChooseQuery,
  query,
  rootRef,
}: SearchControllerProps): null | ReactElement => {
  const navigate = useNavigate();
  const listboxId = useId();
  const commandsRef = useRef<null | SearchPanelCommandsValue>(null);
  const [field, dispatch] = useReducer(
    searchFieldReducer,
    undefined,
    () => createInitialState(pendingChooseQuery),
  );

  const { activeOptionDomId, isPanelOpen } = field;

  const handleActiveOptionChange = useCallback((optionDomId: string | undefined): void => {
    dispatch({ kind: 'active-option-changed', optionDomId });
  }, []);

  const handleChoose = useCallback((address: AppAddressValue): void => {
    console.log('> SearchController -> handleChoose:', { address });
    dispatch({ kind: 'dismissed' });
    onQueryReset();
    onPhoneFieldClose();
    navigate(address, { isFocusRequested: true });
  }, [navigate, onPhoneFieldClose, onQueryReset]);

  const handleDismiss = useCallback((): void => {
    console.log('> SearchController -> handleDismiss:', {});
    dispatch({ kind: 'dismissed' });
  }, []);

  const handlePendingChooseSettled = useCallback((): void => {
    dispatch({ kind: 'pending-choose-settled' });
  }, []);

  const handleMount = useEffectEvent((): void => {
    if (document.activeElement === inputRef.current) {
      dispatch({ kind: 'focused' });
    }

    onPendingChooseConsumed();
  });

  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (event.isComposing) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      console.log('> SearchController -> handleKeyDown:', { key: event.key });
      event.preventDefault();

      if (isPanelOpen) {
        commandsRef.current?.move(event.key === 'ArrowDown' ? 1 : -1);
      }
      else {
        dispatch({ kind: 'arrow-pressed' });
      }
    }

    if (event.key === 'Enter') {
      console.log('> SearchController -> handleKeyDown:', { key: event.key });
      event.preventDefault();

      const commands = commandsRef.current;

      if (getEnterOutcome(field, query, commands !== null) === 'choose') {
        commands?.choose();
      }
      else {
        dispatch({ isPanelLoaded: commands !== null, kind: 'enter-pressed', query });
      }
    }

    if (event.key === 'Escape') {
      console.log('> SearchController -> handleKeyDown:', { key: event.key });
      event.preventDefault();

      if (isPanelOpen) {
        dispatch({ kind: 'dismissed' });
      }
      else {
        onFieldExit();
      }
    }
  });

  useEffect(() => {
    handleMount();
  }, []);

  useEffect(() => {
    const input = inputRef.current;

    if (input === null) {
      return;
    }

    const handleNativeKeyDown = (event: KeyboardEvent): void => {
      handleKeyDown(event);
    };

    const handleNativeFocus = (): void => {
      dispatch({ kind: 'focused' });
    };

    const handleNativeInput = (): void => {
      dispatch({ kind: 'query-changed' });
    };

    const handleNativeBlur = (event: FocusEvent): void => {
      const { relatedTarget } = event;
      const isToInside = relatedTarget instanceof Node && rootRef.current?.contains(relatedTarget) === true;

      if (!isToInside) {
        dispatch({ kind: 'dismissed' });
      }
    };

    input.addEventListener('keydown', handleNativeKeyDown);
    input.addEventListener('focus', handleNativeFocus);
    input.addEventListener('click', handleNativeFocus);
    input.addEventListener('input', handleNativeInput);
    input.addEventListener('blur', handleNativeBlur);

    return () => {
      input.removeEventListener('keydown', handleNativeKeyDown);
      input.removeEventListener('focus', handleNativeFocus);
      input.removeEventListener('click', handleNativeFocus);
      input.removeEventListener('input', handleNativeInput);
      input.removeEventListener('blur', handleNativeBlur);
    };
  }, [inputRef, rootRef]);

  useLayoutEffect(() => {
    const input = inputRef.current;

    if (input === null || !isPanelOpen) {
      return;
    }

    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', listboxId);
    input.setAttribute('aria-autocomplete', 'list');

    return () => {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-autocomplete');
    };
  }, [inputRef, isPanelOpen, listboxId]);

  useEffect(() => {
    const input = inputRef.current;

    if (input === null || !isPanelOpen || activeOptionDomId === undefined) {
      return;
    }

    input.setAttribute('aria-activedescendant', activeOptionDomId);

    return () => {
      input.removeAttribute('aria-activedescendant');
    };
  }, [activeOptionDomId, inputRef, isPanelOpen]);

  if (!isPanelOpen) {
    return null;
  }

  return (
    <GlobalSearchPanel
      commandsRef={commandsRef}
      listboxId={listboxId}
      onActiveOptionChange={handleActiveOptionChange}
      onChoose={handleChoose}
      onDismiss={handleDismiss}
      onPendingChooseSettled={handlePendingChooseSettled}
      organizationId={organizationId}
      pendingChooseQuery={field.pendingChooseQuery}
      query={query}
      rootRef={rootRef}
    />
  );
};
