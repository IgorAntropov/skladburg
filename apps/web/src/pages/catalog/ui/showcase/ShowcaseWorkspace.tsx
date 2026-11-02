import type { ReactElement } from 'react';

import {
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ShowcaseListParamsValue } from '@/entities/listing';
import type { ObjectRefValue } from '@/shared/routing';

import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { useDebouncedText } from '../../lib/useDebouncedText';
import { ShowcaseFilters } from './ShowcaseFilters';
import { ShowcaseResults } from './ShowcaseResults';

interface ShowcaseWorkspaceProps {
  destination: DestinationOptionValue;
  destinationOptions: readonly DestinationOptionValue[];
  focus: ObjectRefValue | undefined;
  onDestinationChange: (warehouseId: string) => void;
}

const SEARCH_DELAY_MS = 300;

const MAX_SEARCH_LENGTH = 100;

export const ShowcaseWorkspace = ({
  destination,
  destinationOptions,
  focus,
  onDestinationChange,
}: ShowcaseWorkspaceProps): ReactElement => {
  const searchRef = useRef<HTMLInputElement>(null);
  const [sphereId, setSphereId] = useState('');
  const [hasSearchText, setHasSearchText] = useState(false);
  const { appliedText, reset: resetSearch, setText } = useDebouncedText(SEARCH_DELAY_MS);

  const params = useMemo<ShowcaseListParamsValue>(
    () => ({ query: appliedText.slice(0, MAX_SEARCH_LENGTH), sphereId, toWarehouseId: destination.id }),
    [appliedText, destination.id, sphereId],
  );

  const isFiltered = appliedText !== '' || sphereId !== '';
  const isResetShown = hasSearchText || sphereId !== '';

  const handleSearchChange = (text: string): void => {
    setHasSearchText(text !== '');
    setText(text);
  };

  const handleReset = (): void => {
    console.log('> ShowcaseWorkspace -> handleReset:', { sphereId });

    if (searchRef.current !== null) {
      searchRef.current.value = '';
    }

    setHasSearchText(false);
    setSphereId('');
    resetSearch();
    searchRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <ShowcaseFilters
        destination={destination}
        destinationOptions={destinationOptions}
        isResetShown={isResetShown}
        onDestinationChange={onDestinationChange}
        onReset={handleReset}
        onSearchChange={handleSearchChange}
        onSphereChange={setSphereId}
        searchRef={searchRef}
        sphereId={sphereId}
      />
      <ShowcaseResults focus={focus} isFiltered={isFiltered} onReset={handleReset} params={params} />
    </div>
  );
};
