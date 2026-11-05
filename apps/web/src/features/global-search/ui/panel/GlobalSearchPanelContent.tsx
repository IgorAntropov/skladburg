import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import type { AppAddressValue } from '@/shared/routing';

import { cn } from '@/shared/lib/cn';
import { resolveScrollBehavior } from '@/shared/lib/scroll';
import { useAnnounce } from '@/shared/ui';

import type { GlobalSearchTranslate } from '../../i18n/globalSearchSection';
import type { SearchPanelProps } from '../../model/searchPanelTypes';
import type {
  SearchGroupValue,
  SearchOptionValue,
} from '../../model/searchResultTypes';

import { useGlobalSearch } from '../../api/useGlobalSearch';
import { SEARCH_GROUP_ORDER } from '../../model/searchResultTypes';
import {
  isSearchSettled,
  resolvePendingChoose,
} from './pendingChoose';
import { SearchGroupSection } from './SearchGroupSection';
import {
  INITIAL_SEARCH_LIST_STATE,
  resolveActiveOptionId,
  searchListReducer,
} from './searchListReducer';
import { toOptionDomId } from './searchPanelConfig';
import { SearchPanelStates } from './SearchPanelStates';
import { useOutsideDismiss } from './useOutsideDismiss';
import { useViewportHeightVariable } from './useViewportHeightVariable';

const PANEL_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden',
  'max-h-[min(28rem,calc(var(--global-search-viewport,100dvh)-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]',
  'rounded-panel border border-line bg-panel-solid text-on-panel shadow-raised',
  'origin-top-right [--menu-in-y:-0.25rem] motion-safe:animate-menu-in',
  'xl:right-auto xl:left-0 xl:origin-top-left',
  'max-sm:right-3 max-sm:left-3 max-sm:w-auto max-sm:max-w-none max-sm:origin-top',
].join(' ');

const LISTBOX_CLASS_NAME = 'scroll-shadow-y min-h-0 flex-1 overflow-y-auto overscroll-contain p-1';

export interface GlobalSearchPanelContentProps extends SearchPanelProps {
  t: GlobalSearchTranslate;
}

interface OptionEntryValue {
  domId: string;
  option: SearchOptionValue;
}

const findEntryAddress = (entries: readonly OptionEntryValue[], domId: string | undefined): AppAddressValue | undefined => (
  entries.find(entry => entry.domId === domId)?.option.address
);

const compareGroups = (current: SearchGroupValue, prev: SearchGroupValue): number => (
  SEARCH_GROUP_ORDER.indexOf(current.id) - SEARCH_GROUP_ORDER.indexOf(prev.id)
);

export const GlobalSearchPanelContent = ({
  commandsRef,
  listboxId,
  onActiveOptionChange,
  onChoose,
  onDismiss,
  onPendingChooseSettled,
  organizationId,
  pendingChooseQuery,
  query,
  rootRef,
  t,
}: GlobalSearchPanelContentProps): ReactElement => {
  const search = useGlobalSearch(query, organizationId);
  const announce = useAnnounce();
  const [list, dispatchList] = useReducer(searchListReducer, INITIAL_SEARCH_LIST_STATE);
  const panelRef = useRef<HTMLDivElement>(null);
  const [heldSkeletonCount, setHeldSkeletonCount] = useState(0);

  const { groups, normalizedQuery, status } = search;

  const sortedGroups = useMemo(() => groups.toSorted(compareGroups), [groups]);

  const entries = useMemo((): OptionEntryValue[] => sortedGroups.flatMap(group => (
    group.options.map(option => ({ domId: toOptionDomId(listboxId, group.id, option.objectId), option }))
  )), [listboxId, sortedGroups]);

  const optionIds = useMemo(() => entries.map(entry => entry.domId), [entries]);

  const activeId = resolveActiveOptionId(list, normalizedQuery, optionIds);
  const isSettled = isSearchSettled(search) && heldSkeletonCount === 0;
  const reportedActiveId = isSettled ? activeId : undefined;
  const optionCount = entries.length;
  const hasOptions = optionCount > 0;
  const hasMore = sortedGroups.some(group => group.hasMore);
  const isListboxHidden = sortedGroups.length === 0;
  const isSurfaceHidden = isListboxHidden && status === 'searching';

  const pendingOutcome = resolvePendingChoose({ hasOptions, isSettled, normalizedQuery, pendingChooseQuery });

  const announcement = useMemo((): string | undefined => {
    if (!isSettled) {
      return undefined;
    }

    if (status === 'empty') {
      return t('globalSearch.empty.title');
    }

    if (status !== 'ready' || optionCount === 0) {
      return undefined;
    }

    return t(hasMore ? 'globalSearch.announce.foundMore' : 'globalSearch.announce.found', { count: optionCount });
  }, [hasMore, isSettled, optionCount, status, t]);

  const handleActivate = useCallback((domId: string): void => {
    dispatchList({ kind: 'pointer-activated', normalizedQuery, optionId: domId });
  }, [normalizedQuery]);

  const handleSkeletonHold = useCallback((): (() => void) => {
    console.log('> GlobalSearchPanelContent -> handleSkeletonHold:', {});
    setHeldSkeletonCount(current => current + 1);

    return (): void => {
      setHeldSkeletonCount(current => current - 1);
    };
  }, []);

  const handleSurfacePress = (event: SyntheticEvent): void => {
    console.log('> GlobalSearchPanelContent -> handleSurfacePress:', { type: event.type });
    event.preventDefault();
  };

  const handleMoveCommand = useEffectEvent((step: -1 | 1): void => {
    console.log('> GlobalSearchPanelContent -> handleMoveCommand:', { step });
    dispatchList({ kind: 'moved', normalizedQuery, optionIds, step });
  });

  const handleChooseCommand = useEffectEvent((): void => {
    console.log('> GlobalSearchPanelContent -> handleChooseCommand:', { activeId });

    const address = findEntryAddress(entries, activeId);

    if (address !== undefined) {
      onChoose(address);
    }
  });

  const handlePendingOutcome = useEffectEvent((): void => {
    console.log('> GlobalSearchPanelContent -> handlePendingOutcome:', { pendingOutcome });
    onPendingChooseSettled();

    const address = pendingOutcome === 'choose' ? findEntryAddress(entries, activeId) : undefined;

    if (address !== undefined) {
      onChoose(address);
    }
  });

  const handleActiveOptionReport = useEffectEvent((): void => {
    onActiveOptionChange(reportedActiveId);
  });

  const handleAnnouncement = useEffectEvent((message: string): void => {
    announce(message);
  });

  useOutsideDismiss(rootRef, onDismiss);
  useViewportHeightVariable(panelRef);

  useEffect(() => {
    commandsRef.current = {
      choose: (): void => {
        handleChooseCommand();
      },
      move: (step): void => {
        handleMoveCommand(step);
      },
    };

    return () => {
      commandsRef.current = null;
    };
  }, [commandsRef]);

  useEffect(() => {
    if (pendingOutcome === 'cancel' || pendingOutcome === 'choose') {
      handlePendingOutcome();
    }
  }, [pendingOutcome]);

  useEffect(() => {
    handleActiveOptionReport();
  }, [query, reportedActiveId]);

  useEffect(() => {
    if (reportedActiveId !== undefined) {
      document.getElementById(reportedActiveId)?.scrollIntoView({ behavior: resolveScrollBehavior(), block: 'nearest' });
    }
  }, [reportedActiveId]);

  useEffect(() => {
    if (announcement !== undefined) {
      handleAnnouncement(announcement);
    }
  }, [announcement, normalizedQuery]);

  return (
    <div
      className={cn(PANEL_CLASS_NAME, isSurfaceHidden && 'invisible')}
      data-testid="global-search-panel"
      onMouseDown={handleSurfacePress}
      onPointerDown={handleSurfacePress}
      ref={panelRef}
    >
      <div
        aria-label={t('globalSearch.panel.label')}
        className={cn(LISTBOX_CLASS_NAME, isListboxHidden && 'hidden')}
        id={listboxId}
        role="listbox"
      >
        {sortedGroups.map(group => (
          <SearchGroupSection
            activeId={activeId}
            group={group}
            key={group.id}
            listboxId={listboxId}
            onActivate={handleActivate}
            onChoose={onChoose}
            onSkeletonHold={handleSkeletonHold}
            t={t}
          />
        ))}
      </div>
      <SearchPanelStates status={status} t={t} />
    </div>
  );
};
