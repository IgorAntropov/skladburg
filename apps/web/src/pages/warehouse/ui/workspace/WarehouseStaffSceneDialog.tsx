import type {
  ReactElement,
  RefObject,
  SyntheticEvent,
} from 'react';

import {
  useEffect,
  useId,
  useRef,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  ErrorNotice,
  Skeleton,
} from '@/shared/ui';

import { warehouseStaffSection } from '../../i18n/warehouseStaffSection';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const Profile = state.kind === 'loaded' ? state.module.WarehouseStaffProfileDetails : undefined;

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const fallback = fallbackFocus.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (document.activeElement === document.body) {
        const target = trigger instanceof HTMLElement && trigger !== document.body && trigger.isConnected ? trigger : fallback;
        target?.focus({ preventScroll: true });
      }
    };
  }, [fallbackFocus]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[min(94vw,28rem)] overflow-auto rounded-panel border border-line bg-panel-solid p-4 text-on-panel"
      data-testid="warehouse-staff-scene-profile"
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id={titleId}>{t?.('warehouseStaff.profile') ?? baseText('hud.inspector.title')}</h2>
        <Button data-testid="warehouse-staff-scene-close" onClick={onClose} variant="secondary">{baseText('hud.inspector.close')}</Button>
      </header>
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
    </dialog>
  );
};
