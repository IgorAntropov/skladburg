import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { ComponentType } from 'react';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { CommandAccessValue } from '@/shared/api';
import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import { createNetworkDirectoryQueryOptions } from '@/entities/network';
import { useCommandAccess } from '@/entities/session';
import { useApiClient } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  getChunkRecovery,
} from '@/shared/lib/module-loader';
import {
  useAnnounce,
  useFocusHandoff,
} from '@/shared/ui';

import type { CreateWarehouseFormProps } from '../ui/form/CreateWarehouseForm';

import { loadCreateWarehouseForm } from '../ui/loadCreateWarehouseForm';
import { CREATE_WAREHOUSE_FOCUS_KEY } from './createWarehouseFocusKey';

export interface CreateWarehouseLauncherValue {
  access: CommandAccessValue;
  close: () => void;
  complete: (warehouse: Warehouse) => void;
  Form: ComponentType<CreateWarehouseFormProps> | undefined;
  isLoading: boolean;
  isOpen: boolean;
  loadRecovery: ChunkRecoveryValue | undefined;
  open: () => void;
  panelId: string;
  warmUp: () => void;
}

type CreateWarehouseFormModuleValue = Awaited<ReturnType<typeof loadCreateWarehouseForm>>;

type LaunchStateValue
  = | { Form: ComponentType<CreateWarehouseFormProps>; kind: 'open' }
    | { kind: 'closed' }
    | { kind: 'error'; recovery: ChunkRecoveryValue }
    | { kind: 'loading' };

const CLOSED_STATE: LaunchStateValue = { kind: 'closed' };
const LOADING_STATE: LaunchStateValue = { kind: 'loading' };

const FIRST_FIELD_SELECTOR = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

const loadCachedCreateWarehouseForm = createCachedModuleLoader(loadCreateWarehouseForm);

export const useCreateWarehouseLauncher = (): CreateWarehouseLauncherValue => {
  const { t } = useI18n();
  const announce = useAnnounce();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { cancelFocus, requestFocus } = useFocusHandoff<HTMLButtonElement>(CREATE_WAREHOUSE_FOCUS_KEY);
  const access = useCommandAccess(OrganizationService.method.createWarehouse);
  const panelId = useId();
  const requestSequenceRef = useRef(0);
  const isFormOpenRef = useRef(false);
  const [launchState, setLaunchState] = useState<LaunchStateValue>(CLOSED_STATE);

  const isAllowed = access.status === 'allowed';
  const isLoading = launchState.kind === 'loading';
  const isOpen = launchState.kind === 'open';
  const loadRecovery = launchState.kind === 'error' ? launchState.recovery : undefined;
  const Form = launchState.kind === 'open' ? launchState.Form : undefined;

  const warmUp = useCallback((): void => {
    if (!isAllowed) {
      return;
    }

    if (loadCachedCreateWarehouseForm.peekLoadedModule() === undefined) {
      void loadCachedCreateWarehouseForm().then(undefined, (error: unknown) => {
        console.log('> useCreateWarehouseLauncher -> warmUp:', { error });
      });
    }
    void queryClient.query(createNetworkDirectoryQueryOptions(client)).catch((error: unknown) => {
      console.log('> useCreateWarehouseLauncher -> warmUp:', { error });
    });
  }, [client, isAllowed, queryClient]);

  const showForm = useCallback((loadedModule: CreateWarehouseFormModuleValue): void => {
    isFormOpenRef.current = true;
    setLaunchState({ Form: loadedModule.CreateWarehouseForm, kind: 'open' });
  }, []);

  const focusFirstField = useCallback((): void => {
    const panel = document.getElementById(panelId);

    panel?.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)?.focus();
  }, [panelId]);

  const open = useCallback((): void => {
    console.log('> useCreateWarehouseLauncher -> open:', { isAllowed, kind: launchState.kind });
    if (!isAllowed || launchState.kind === 'loading') {
      return;
    }

    if (launchState.kind === 'open') {
      focusFirstField();

      return;
    }

    cancelFocus();
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;
    const loadedModule = loadCachedCreateWarehouseForm.peekLoadedModule();

    if (loadedModule !== undefined) {
      showForm(loadedModule);

      return;
    }

    setLaunchState(LOADING_STATE);
    void loadCachedCreateWarehouseForm().then(
      (module) => {
        if (requestSequenceRef.current === requestSequence) {
          showForm(module);
        }
      },
      (error: unknown) => {
        console.log('> useCreateWarehouseLauncher -> open:', { error });
        if (requestSequenceRef.current === requestSequence) {
          setLaunchState({ kind: 'error', recovery: getChunkRecovery(error) });
        }
      },
    );
  }, [cancelFocus, focusFirstField, isAllowed, launchState.kind, showForm]);

  const close = useCallback((): void => {
    console.log('> useCreateWarehouseLauncher -> close:', {});
    requestSequenceRef.current += 1;
    isFormOpenRef.current = false;
    requestFocus();
    setLaunchState(CLOSED_STATE);
  }, [requestFocus]);

  const complete = useCallback((warehouse: Warehouse): void => {
    const isFormOpen = isFormOpenRef.current;

    console.log('> useCreateWarehouseLauncher -> complete:', { isFormOpen, warehouseId: warehouse.id });
    announce(t('warehouse.create.created', { name: warehouse.name }));

    if (!isFormOpen) {
      return;
    }

    requestSequenceRef.current += 1;
    isFormOpenRef.current = false;
    requestFocus();
    setLaunchState(CLOSED_STATE);
  }, [announce, requestFocus, t]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    isFormOpenRef.current = false;
  }, []);

  return useMemo(() => ({
    access,
    close,
    complete,
    Form,
    isLoading,
    isOpen,
    loadRecovery,
    open,
    panelId,
    warmUp,
  }), [
    access,
    close,
    complete,
    Form,
    isLoading,
    isOpen,
    loadRecovery,
    open,
    panelId,
    warmUp,
  ]);
};
