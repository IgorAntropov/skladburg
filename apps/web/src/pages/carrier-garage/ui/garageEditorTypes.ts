import type {
  CarrierLane,
  Driver,
  Vehicle,
} from '@skladburg/contracts/fleet/v1/fleet';
import type { City } from '@skladburg/contracts/network/v1/network';

export interface GarageEditorSlotProps {
  cities: readonly City[];
  editor: GarageEditorValue;
  onClose: () => void;
  onSaved: (record: GarageRecordValue) => void;
}

export type GarageEditorValue
  = | { kind: 'drivers'; record: Driver | undefined }
    | { kind: 'lanes'; record: CarrierLane | undefined }
    | { kind: 'vehicles'; record: undefined | Vehicle };

export type GarageRecordValue = CarrierLane | Driver | Vehicle;
