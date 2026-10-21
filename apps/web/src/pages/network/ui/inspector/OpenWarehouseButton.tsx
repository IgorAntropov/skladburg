import type { ReactElement } from 'react';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import { useCommandAccess } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import { useNavigate } from '@/shared/routing';
import { AccessButton } from '@/shared/ui';

interface OpenWarehouseButtonProps {
  warehouseId: string;
}

export const OpenWarehouseButton = ({ warehouseId }: OpenWarehouseButtonProps): ReactElement => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const access = useCommandAccess(OrganizationService.method.listWarehouses, { kind: 'warehouse', warehouseId });

  const handleClick = (): void => {
    console.log('> OpenWarehouseButton -> handleClick:', { warehouseId });
    navigate({ kind: 'object', object: { id: warehouseId, type: 'warehouse' } });
  };

  return (
    <AccessButton access={access} data-testid="network-inspector-open-warehouse" onClick={handleClick} variant="primary">
      {t('network.inspector.openWarehouse')}
    </AccessButton>
  );
};
