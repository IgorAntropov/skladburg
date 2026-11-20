import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { WarehouseSceneStaffAreaValue } from '../model/warehouseSceneInteraction';

import { warehouseSceneStaffMessages } from '../i18n/warehouseSceneStaffRu';
import { projectWarehouseSceneStaff } from '../model/warehouseSceneStaff';
import { useWarehouseStaffPresence } from './useWarehouseStaffPresence';
import { useWarehouseStaffList } from './useWarehouseStaffProfiles';

interface WarehouseSceneStaffValue {
  closeProfile: () => void;
  formatStaffOverflow: (count: number) => string;
  selectedStaffId: string | undefined;
  selectStaff: (staffId: string) => void;
  staffAreas: readonly WarehouseSceneStaffAreaValue[];
}

export const useWarehouseSceneStaff = (warehouseId: string, isEnabled: boolean, focusRequest: number): WarehouseSceneStaffValue => {
  const i18n = useI18n();
  const presence = useWarehouseStaffPresence(warehouseId, isEnabled);
  const list = useWarehouseStaffList(warehouseId, isEnabled);
  const [selection, setSelection] = useState<{ focusRequest: number; staffId: string }>();
  const members = isEnabled && !isReadAccessDenied(list.error) ? list.data : undefined;
  const areas = isEnabled && !isReadAccessDenied(presence.error) ? presence.data?.areas : undefined;
  const staffAreas = useMemo(() => projectWarehouseSceneStaff(areas, members, warehouseId, i18n), [areas, i18n, members, warehouseId]);
  const selectedStaffId = selection?.focusRequest === focusRequest && members?.some(member => member.staffId === selection.staffId)
    ? selection.staffId
    : undefined;

  const selectStaff = useCallback((staffId: string): void => {
    if (members?.some(member => member.staffId === staffId && member.warehouseId === warehouseId && member.observedAreaId !== undefined)) {
      setSelection({ focusRequest, staffId });
    }
  }, [focusRequest, members, warehouseId]);

  const closeProfile = useCallback((): void => {
    setSelection(undefined);
  }, []);

  const formatStaffOverflow = useCallback((count: number): string => i18n.createSectionTranslator(warehouseSceneStaffMessages)(
    'warehouseSceneStaff.overflow', { count: i18n.formatNumber(count) },
  ), [i18n]);

  if (selection !== undefined && selectedStaffId === undefined) {
    setSelection(undefined);
  }
  return { closeProfile, formatStaffOverflow, selectedStaffId, selectStaff, staffAreas };
};
