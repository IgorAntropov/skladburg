import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehousePlacesValue } from '../../model/warehousePlacesTypes';

import { useWarehousePlacesQuery } from '../../api/useWarehousePlacesQuery';
import { getPlacesRecovery } from '../../lib/getPlacesRecovery';
import { CreateWarehouseRecoveryNotice } from '../CreateWarehouseRecoveryNotice';
import { CreateWarehouseFormBody } from './CreateWarehouseFormBody';

const SKELETON_FIELD_CLASS_NAMES = [
  { className: 'h-14 w-full', id: 'name' },
  { className: 'mb-6 h-14 w-full', id: 'city' },
  { className: 'h-14 w-full', id: 'address' },
] as const;

const CANCEL_CLASS_NAME = 'mt-2 self-start';

const isPlacesEmpty = (places: WarehousePlacesValue): boolean => places.cities.length === 0;

export interface CreateWarehouseFormProps {
  onCancel: () => void;
  onCreated: (warehouse: Warehouse) => void;
}

export const CreateWarehouseForm = ({ onCancel, onCreated }: CreateWarehouseFormProps): ReactElement => {
  const { t } = useI18n();
  const {
    data: places,
    error,
    isFetching,
    refetch,
  } = useWarehousePlacesQuery();

  const isFormShown = places !== undefined && !isPlacesEmpty(places);
  const isReloadNeeded = places === undefined && error !== null && getPlacesRecovery(error) === 'reload';

  const handleRetry = (): void => {
    console.log('> CreateWarehouseForm -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  const handleCancelClick = (): void => {
    console.log('> CreateWarehouseForm -> handleCancelClick:', {});
    onCancel();
  };

  const skeleton = (
    <div className="flex w-full max-w-md flex-col gap-4">
      {SKELETON_FIELD_CLASS_NAMES.map(field => <Skeleton className={field.className} key={field.id} />)}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {isReloadNeeded
        ? <CreateWarehouseRecoveryNotice message={t('warehouse.create.cities_outdated')} recovery="reload" />
        : (
            <WidgetStates
              data={places}
              empty={<p className="text-base leading-6 text-on-panel-muted">{t('warehouse.create.cities_empty')}</p>}
              error={error}
              isEmpty={isPlacesEmpty}
              isRetrying={isFetching}
              loadingLabel={t('warehouse.create.cities_loading')}
              onRetry={handleRetry}
              skeleton={skeleton}
            >
              {loadedPlaces => <CreateWarehouseFormBody onCancel={onCancel} onCreated={onCreated} places={loadedPlaces} />}
            </WidgetStates>
          )}
      {!isFormShown && (
        <Button className={CANCEL_CLASS_NAME} data-testid="create-warehouse-cancel" onClick={handleCancelClick} variant="secondary">
          {t('warehouse.create.cancel')}
        </Button>
      )}
    </div>
  );
};
