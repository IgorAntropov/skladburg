import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  ReactElement,
} from 'react';

import {
  Search,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  IconButton,
  TextInput,
} from '@/shared/ui';

import { useSlashHotkey } from '../lib/useSlashHotkey';

const FIELD_CLASS_NAME = 'relative min-w-0 sm:max-w-72 sm:min-w-28 sm:flex-1';
const INPUT_CLASS_NAME = [
  'ps-10 pe-3 focus-visible:border-focus focus-visible:outline-offset-0 xl:pe-10',
  '[&::-webkit-search-cancel-button]:appearance-none',
].join(' ');
const SEARCH_ICON_CLASS_NAME = 'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-panel-muted';
const SHORTCUT_HINT_CLASS_NAME = [
  'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border border-line px-1.5 text-xs text-on-panel-muted',
  'max-xl:hidden peer-not-placeholder-shown:hidden [@media(hover:none)]:hidden',
].join(' ');
const UNAVAILABLE_CLASS_NAME = 'absolute top-full left-0 z-20 mt-1 w-max max-w-72 min-w-full';
const UNAVAILABLE_NOTE_CLASS_NAME = [
  'block rounded-control border border-line bg-panel-solid px-3 py-2 text-sm text-on-panel shadow-panel',
  'empty:hidden',
].join(' ');
const PHONE_FIELD_CLOSED_CLASS_NAME = 'max-sm:hidden';
const PHONE_FIELD_OPEN_CLASS_NAME = 'max-sm:flex-1';

const isDisplayed = (element: HTMLElement): boolean => {
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') {
      return false;
    }
  }

  return true;
};

const focusIfVisible = (element: HTMLElement | null): void => {
  if (element !== null && isDisplayed(element)) {
    element.focus();
  }
};

export interface SearchFieldProps {
  isPhoneFieldOpen: boolean;
  onPhoneFieldOpenChange: (isOpen: boolean) => void;
}

export const SearchField = ({ isPhoneFieldOpen, onPhoneFieldOpenChange }: SearchFieldProps): ReactElement => {
  const { t } = useI18n();
  const fieldId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | undefined>(undefined);
  const isToggleFocusPendingRef = useRef(false);
  const [query, setQuery] = useState('');
  const [unavailableSequence, setUnavailableSequence] = useState(0);

  const hotkeyActivate = useCallback((): void => {
    onPhoneFieldOpenChange(true);
  }, [onPhoneFieldOpenChange]);

  useSlashHotkey(inputRef, hotkeyActivate);

  const isUnavailableShown = unavailableSequence > 0;

  const handleToggleClick = (): void => {
    console.log('> SearchField -> handleToggleClick:', { isPhoneFieldOpen });
    onPhoneFieldOpenChange(true);
  };

  const closeField = (): void => {
    setQuery('');
    setUnavailableSequence(0);
    onPhoneFieldOpenChange(false);
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value);
    setUnavailableSequence(0);
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    const { relatedTarget } = event;
    previousFocusRef.current = relatedTarget instanceof HTMLElement ? relatedTarget : undefined;
  };

  const returnFocus = (): void => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = undefined;

    const isPreviousReturnable = previous !== undefined
      && previous.isConnected
      && previous !== inputRef.current
      && previous !== toggleRef.current
      && isDisplayed(previous);

    if (isPreviousReturnable) {
      previous.focus();

      return;
    }

    if (isPhoneFieldOpen) {
      isToggleFocusPendingRef.current = true;

      return;
    }

    focusIfVisible(toggleRef.current);
  };

  const handleCloseClick = (): void => {
    console.log('> SearchField -> handleCloseClick:', {});
    previousFocusRef.current = undefined;
    closeField();
    returnFocus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      console.log('> SearchField -> handleKeyDown:', { key: event.key });
      event.preventDefault();
      setUnavailableSequence(current => current + 1);
    }

    if (event.key === 'Escape') {
      console.log('> SearchField -> handleKeyDown:', { key: event.key });
      event.preventDefault();
      closeField();
      returnFocus();
    }
  };

  useEffect(() => {
    if (isPhoneFieldOpen) {
      inputRef.current?.focus();

      return;
    }

    if (isToggleFocusPendingRef.current) {
      isToggleFocusPendingRef.current = false;
      focusIfVisible(toggleRef.current);
    }
  }, [isPhoneFieldOpen]);

  return (
    <>
      <IconButton
        aria-controls={fieldId}
        aria-expanded={isPhoneFieldOpen}
        className={cn('ml-auto sm:hidden', isPhoneFieldOpen && 'max-sm:hidden')}
        icon={<Search className="size-5" />}
        label={t('search.open')}
        onClick={handleToggleClick}
        ref={toggleRef}
        variant="ghost"
      />
      <div
        className={cn(FIELD_CLASS_NAME, isPhoneFieldOpen ? PHONE_FIELD_OPEN_CLASS_NAME : PHONE_FIELD_CLOSED_CLASS_NAME)}
        id={fieldId}
        role="search"
      >
        <label className="sr-only" htmlFor={inputId}>{t('search.label')}</label>
        <div className="relative">
          <Search aria-hidden className={SEARCH_ICON_CLASS_NAME} />
          <TextInput
            aria-keyshortcuts="/"
            autoComplete="off"
            className={cn('peer', INPUT_CLASS_NAME)}
            id={inputId}
            name="search"
            onChange={handleQueryChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            ref={inputRef}
            spellCheck={false}
            type="search"
            value={query}
          />
          <kbd aria-hidden className={SHORTCUT_HINT_CLASS_NAME}>/</kbd>
        </div>
        <p className={UNAVAILABLE_CLASS_NAME} role="status">
          <span className={UNAVAILABLE_NOTE_CLASS_NAME} key={unavailableSequence}>{isUnavailableShown ? t('search.unavailable') : ''}</span>
        </p>
      </div>
      {isPhoneFieldOpen && (
        <IconButton
          className="sm:hidden"
          icon={<X className="size-5" />}
          label={t('search.close')}
          onClick={handleCloseClick}
          variant="ghost"
        />
      )}
    </>
  );
};
