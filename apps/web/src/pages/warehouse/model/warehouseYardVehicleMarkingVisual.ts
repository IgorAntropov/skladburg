export type WarehouseYardVehicleAccentValue = 'blue' | 'green' | 'ochre' | 'slate' | 'terracotta';

export interface WarehouseYardVehicleMarkingVisualValue {
  accent: undefined | WarehouseYardVehicleAccentValue;
  brandName: string | undefined;
  logoPath: string | undefined;
  registrationNumber: string | undefined;
}
