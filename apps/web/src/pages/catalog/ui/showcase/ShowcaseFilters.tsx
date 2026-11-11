import type {
  ChangeEvent,
  ReactElement,
  Ref,
} from 'react';

import {
  ChevronDown,
  ChevronUp,
  Funnel,
} from 'lucide-react';
import {
  useId,
  useMemo,
  useState,
} from 'react';

import {
  buildSphereTree,
  useSpheresQuery,
} from '@/entities/organization';
import {
  Button,
  SelectField,
} from '@/shared/ui';

import type { CatalogPageTranslate } from '../../i18n/catalogSection';
import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { useCatalogTexts } from '../../model/useCatalogTexts';
import { CatalogSearchField } from '../CatalogSearchField';

interface ShowcaseFiltersProps {
  destination: DestinationOptionValue;
  destinationOptions: readonly DestinationOptionValue[];
  isResetShown: boolean;
  onDestinationChange: (warehouseId: string) => void;
  onReset: () => void;
  onSearchChange: (text: string) => void;
  onSphereChange: (sphereId: string) => void;
  searchRef: Ref<HTMLInputElement>;
  sphereId: string;
}

const BRANCH_MARK = '– ';

const GRID_CLASS_NAME = 'grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-[1.4fr_1fr_1fr]';

const OPEN_BLOCK_CLASS_NAME = 'flex flex-col gap-3 @lg:contents';

const CLOSED_BLOCK_CLASS_NAME = 'hidden @lg:contents';

const formatDestinationLabel = (t: CatalogPageTranslate, option: DestinationOptionValue): string => (
  option.cityName === ''
    ? option.warehouseName
    : t('catalog.filter.destinationOption', { city: option.cityName, warehouse: option.warehouseName })
);

export const ShowcaseFilters = ({
  destination,
  destinationOptions,
  isResetShown,
  onDestinationChange,
  onReset,
  onSearchChange,
  onSphereChange,
  searchRef,
  sphereId,
}: ShowcaseFiltersProps): ReactElement => {
  const { t } = useCatalogTexts();
  const spheresQuery = useSpheresQuery();
  const filtersId = useId();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const sphereOptions = useMemo(() => buildSphereTree(spheresQuery.data ?? []), [spheresQuery.data]);
  const sphereName = sphereOptions.find(option => option.id === sphereId)?.name;
  const summary = [formatDestinationLabel(t, destination), sphereName].filter(part => part !== undefined).join(' · ');

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    console.log('> ShowcaseFilters -> handleSearchChange:', { length: event.target.value.length });
    onSearchChange(event.target.value);
  };

  const handleSphereChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> ShowcaseFilters -> handleSphereChange:', { value: event.target.value });
    onSphereChange(event.target.value);
  };

  const handleDestinationChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> ShowcaseFilters -> handleDestinationChange:', { value: event.target.value });
    onDestinationChange(event.target.value);
  };

  const handleToggleClick = (): void => {
    console.log('> ShowcaseFilters -> handleToggleClick:', { isFiltersOpen });
    setIsFiltersOpen(current => !current);
  };

  const handleResetClick = (): void => {
    console.log('> ShowcaseFilters -> handleResetClick:', {});
    onReset();
  };

  return (
    <div className="@container flex flex-col gap-3">
      <div className={GRID_CLASS_NAME}>
        <CatalogSearchField
          className="@lg:col-span-2 @3xl:col-span-1"
          name="catalog-search"
          onChange={handleSearchChange}
          ref={searchRef}
        />
        <Button
          aria-controls={filtersId}
          aria-expanded={isFiltersOpen}
          className="justify-self-start @lg:hidden"
          data-testid="catalog-filters-toggle"
          onClick={handleToggleClick}
          variant="neutral"
        >
          <Funnel aria-hidden className="size-4 text-on-panel-muted" />
          {t('catalog.filter.toggle')}
          {isFiltersOpen ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
        </Button>
        {!isFiltersOpen && <p className="-mt-1 truncate text-sm leading-5 text-on-panel-muted @lg:hidden">{summary}</p>}
        <div className={isFiltersOpen ? OPEN_BLOCK_CLASS_NAME : CLOSED_BLOCK_CLASS_NAME} id={filtersId}>
          <div data-testid="catalog-sphere-filter">
            <SelectField
              label={t('catalog.filter.sphere')}
              messageLines={0}
              name="catalog-sphere"
              onChange={handleSphereChange}
              value={sphereId}
            >
              <option value="">{t('catalog.filter.sphereAny')}</option>
              {sphereOptions.map(option => (
                <option key={option.id} value={option.id}>{`${BRANCH_MARK.repeat(option.depth)}${option.name}`}</option>
              ))}
            </SelectField>
          </div>
          <div data-testid="catalog-destination-select">
            <SelectField
              label={t('catalog.filter.destination')}
              messageLines={0}
              name="catalog-destination"
              onChange={handleDestinationChange}
              value={destination.id}
            >
              {destinationOptions.map(option => (
                <option key={option.id} value={option.id}>{formatDestinationLabel(t, option)}</option>
              ))}
            </SelectField>
          </div>
          {isResetShown && (
            <Button
              className="self-start @lg:col-span-full"
              data-testid="catalog-filters-reset"
              onClick={handleResetClick}
              variant="ghost"
            >
              {t('catalog.filter.reset')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
