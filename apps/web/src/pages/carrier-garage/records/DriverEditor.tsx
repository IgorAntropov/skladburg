import type { Driver } from '@skladburg/contracts/fleet/v1/fleet';
import type { ReactElement } from 'react';

import { useCatalogSection } from '@/shared/i18n';
import {
  SwitchField,
  TextField,
} from '@/shared/ui';

import { useSaveDriverForm } from '../api/commands/useSaveDriverForm';
import { GarageFormFrame } from '../ui/GarageFormFrame';
import { recordsSection } from './i18n/recordsSection';
import { RecordEditorFallback } from './RecordEditorFallback';

interface DriverEditorProps {
  driver: Driver | undefined;
  onClose: () => void;
  onSaved: (saved: Driver) => void;
}

export const DriverEditor = ({ driver, onClose, onSaved }: DriverEditorProps): ReactElement => {
  const { retry, status, t } = useCatalogSection(recordsSection);
  const form = useSaveDriverForm(driver, onSaved);

  if (t === undefined) {
    return <RecordEditorFallback isError={status === 'error'} onClose={onClose} onRetry={retry} />;
  }

  return (
    <GarageFormFrame
      command={form.command}
      isDirty={form.isDirty}
      onClose={onClose}
      onSubmit={form.handleSubmit}
      testId="garage-driver-form"
      title={t(driver === undefined ? 'garageRecords.driver.create' : 'garageRecords.driver.edit')}
    >
      <div data-testid="garage-driver-name">
        <TextField {...form.getFieldProps('displayName')} label={t('garageRecords.driver.name')} />
      </div>
      <SwitchField {...form.getFieldProps('isActive')} label={t('garageRecords.driver.active')} />
    </GarageFormFrame>
  );
};
