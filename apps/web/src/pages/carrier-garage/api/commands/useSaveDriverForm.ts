import type { Driver } from '@skladburg/contracts/fleet/v1/fleet';

import { FleetService } from '@skladburg/contracts/fleet/v1/fleet';
import { SaveDriverRequestFormRules } from '@skladburg/contracts/forms/fleet/v1/fleet';
import { useState } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  createUuid,
  useApiClient,
} from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

interface DriverFormValue {
  displayName: string;
  isActive: boolean;
}

export const useSaveDriverForm = (
  driver: Driver | undefined,
  onSaved: (saved: Driver) => void,
): CommandFormValue<DriverFormValue> => {
  const client = useApiClient();
  const [baseline] = useState(() => ({ driverId: driver?.id ?? createUuid(), expectedVersion: driver?.version ?? 0n }));

  const execute = async (values: DriverFormValue, idempotencyKey: string): Promise<Driver> => {
    const response = await client.service(FleetService).saveDriver({ ...baseline, ...values, idempotencyKey });

    if (response.driver === undefined) {
      throw new Error('SaveDriver response has no driver');
    }

    return response.driver;
  };

  return useCommandForm({
    defaultValues: { displayName: driver?.displayName ?? '', isActive: driver?.isActive ?? true },
    execute,
    method: FleetService.method.saveDriver,
    onSuccess: onSaved,
    rules: SaveDriverRequestFormRules,
  });
};
