import type { ReactElement } from 'react';

import type { GarageEditorSlotProps } from './garageEditorTypes';

import { CarrierLaneEditor } from '../records/CarrierLaneEditor';
import { DriverEditor } from '../records/DriverEditor';
import { VehicleEditor } from '../vehicle/VehicleEditor';

export const GarageEditorSlot = ({ cities, editor, onClose, onSaved }: GarageEditorSlotProps): ReactElement => {
  switch (editor.kind) {
    case 'drivers':
      return <DriverEditor driver={editor.record} onClose={onClose} onSaved={onSaved} />;
    case 'lanes':
      return <CarrierLaneEditor cities={cities} lane={editor.record} onClose={onClose} onSaved={onSaved} />;
    case 'vehicles':
      return <VehicleEditor cities={cities} onClose={onClose} onSaved={onSaved} vehicle={editor.record} />;
  }
};
