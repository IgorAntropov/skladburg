import type {
  ReactElement,
  RefObject,
} from 'react';

import { useEffect } from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  ChunkLoadNotice,
  ErrorNotice,
  Skeleton,
} from '@/shared/ui';

import { warehouseStaffSection } from '../../i18n/warehouseStaffSection';
import { WarehouseObjectDialog } from './WarehouseObjectDialog';

const loadStaffProfile = createCachedModuleLoader(() => import('./WarehouseStaffProfile'));

interface WarehouseStaffSceneDialogProps {
  fallbackFocus: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  staffId: string;
  warehouseId: string;
}

export const WarehouseStaffSceneDialog = ({
  fallbackFocus, onClose, staffId, warehouseId,
}: WarehouseStaffSceneDialogProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(warehouseStaffSection);
  const { load, state } = useChunkLoader(loadStaffProfile);
  const Profile = state.kind === 'loaded' ? state.module.WarehouseStaffProfileDetails : undefined;

  useEffect(() => {
    load();
  }, [load]);

  return (
    <WarehouseObjectDialog
      closeTestId="warehouse-staff-scene-close"
      fallbackFocus={fallbackFocus}
      onClose={onClose}
      testId="warehouse-staff-scene-profile"
      title={t?.('warehouseStaff.profile') ?? baseText('hud.inspector.title')}
    >
      {state.kind === 'failed'
        ? (
            <ChunkLoadNotice
              message={baseText('routing.chunkError.message')}
              onRetry={load}
              recovery={state.recovery}
              repeatedMessage={baseText('routing.chunkError.repeated')}
            />
          )
        : status === 'error'
          ? <ErrorNotice error={null} onRetry={retry} />
          : Profile !== undefined && t !== undefined
            ? <Profile showIdentity staffId={staffId} t={t} warehouseId={warehouseId} />
            : <Skeleton className="h-28 w-full" />}
    </WarehouseObjectDialog>
  );
};
