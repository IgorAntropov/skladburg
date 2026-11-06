import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { useCommandAccess } from '@/entities/session';
import { useActingContext } from '@/shared/api';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import {
  AccessButton,
  ChunkLoadNotice,
} from '@/shared/ui';

import type { OrderTranslate } from '../../i18n/order/orderSection';
import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { CREATE_DEAL_DRAFT_METHOD } from '../../api/order/createDealDraftMethod';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditLauncher } from '../../model/useEditLauncher';

export interface OrderLauncherProps {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue;
  listing: ShowcaseListing;
  supplierOrganizationId: string;
  t: OrderTranslate;
}

const loadOrderForm = createCachedModuleLoader(() => import('./orderFormEntry'));

const OrderLauncherContent = ({
  cityNames,
  destination,
  listing,
  supplierOrganizationId,
  t,
}: OrderLauncherProps): ReactElement => {
  const { t: catalogT } = useCatalogTexts();
  const access = useCommandAccess(CREATE_DEAL_DRAFT_METHOD);
  const {
    buttonRef,
    close,
    isLoading,
    loadRecovery,
    module,
    open,
  } = useEditLauncher(loadOrderForm, `catalog-order-${listing.id}`);

  const handleOpen = (): void => {
    const canOpen = access.status === 'allowed';
    console.log('> OrderLauncher -> handleOpen:', { canOpen });

    if (canOpen) {
      open();
    }
  };

  if (module !== undefined) {
    const { OrderForm } = module;

    return (
      <OrderForm
        cityNames={cityNames}
        destination={destination}
        listing={listing}
        onClose={close}
        supplierOrganizationId={supplierOrganizationId}
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <AccessButton
        access={access}
        data-testid="order-open"
        onClick={handleOpen}
        pending={isLoading}
        pendingLabel={catalogT('catalog.own.opening')}
        ref={buttonRef}
        variant="primary"
      >
        {t('order.open')}
      </AccessButton>
      {loadRecovery !== undefined && (
        <ChunkLoadNotice
          message={t('order.openError')}
          onRetry={handleOpen}
          recovery={loadRecovery}
          repeatedMessage={catalogT('catalog.chunkError.repeated')}
        />
      )}
    </div>
  );
};

export const OrderLauncher = (props: OrderLauncherProps): ReactElement => {
  const { organizationId, userId } = useActingContext();

  return <OrderLauncherContent {...props} key={`${organizationId ?? ''}:${userId ?? ''}:${props.listing.id}`} />;
};
