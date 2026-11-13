import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { Package } from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import { useWarehousesQuery } from '@/entities/warehouse';
import { useActingContext } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  EmptyState,
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
  TextLink,
} from '@/shared/ui';

import type { WarehouseLayoutRenderValue } from './WarehouseWorkspace';

import { useWarehouseObjectLookup } from '../../api/useWarehouseObjectLookup';
import { warehouseWorkSection } from '../../i18n/workspaceSection';
import { WarehouseWorkspace } from './WarehouseWorkspace';

interface WarehouseWorkspaceRouteProps {
  focus: ObjectRefValue;
  renderLayout: WarehouseLayoutRenderValue;
}

export const WarehouseWorkspaceRoute = ({ focus, renderLayout }: WarehouseWorkspaceRouteProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(warehouseWorkSection);
  const { organizationId, userId } = useActingContext();
  const { data, error, refetch } = useWarehousesQuery();
  const session = useSessionQuery();
  const lookup = useWarehouseObjectLookup(focus, data);
  const warehouseId = focus.type === 'warehouse' ? focus.id : lookup.warehouseId;
  const warehouse = data?.find(candidate => candidate.id === warehouseId && isPermissionGranted(
    session.data?.permissions ?? [], PermissionCode.WAREHOUSE_VIEW, { kind: 'warehouse', warehouseId },
  ));
  const loadError = error ?? session.error ?? lookup.error;

  const handleRetry = (): void => {
    console.log('> WarehouseWorkspaceRoute -> handleRetry:', {});
    void refetch();
    void session.refetch();
    lookup.refetch();
  };

  if (warehouse !== undefined) {
    return (
      <WarehouseWorkspace
        focus={focus}
        key={`${organizationId ?? ''}:${userId ?? ''}:${warehouse.id}`}
        renderLayout={renderLayout}
        warehouse={warehouse}
      />
    );
  }
  if (loadError !== null) {
    return renderLayout(<ErrorNotice error={loadError} onRetry={handleRetry} />);
  }
  if (status === 'error' && t === undefined) {
    return renderLayout(<ErrorNotice error={null} onRetry={retry} />);
  }
  if (data === undefined || session.isPending || lookup.isPending || t === undefined) {
    return renderLayout(
      <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-28 w-full" /></SkeletonGroup>,
    );
  }

  return renderLayout(
    <div className="flex flex-col items-start gap-2">
      <TextLink size="sm" to={{ kind: 'section', section: 'warehouse' }}>{t('warehouseWork.back')}</TextLink>
      <EmptyState data-testid="warehouse-object-unavailable" icon={Package} text={t('warehouseWork.noAccess')} />
    </div>,
  );
};
