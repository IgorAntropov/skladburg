import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';

const areAvailabilitiesEqual = (current: Listing['availability'], saved: Listing['availability']): boolean => (
  current.length === saved.length
  && current.every((entry, index) => {
    const savedEntry = saved[index];

    return entry.warehouseId === savedEntry?.warehouseId
      && entry.status === savedEntry.status
      && entry.quantity === savedEntry.quantity;
  })
);

export const isListingDataEqual = (current: Listing, saved: Listing): boolean => (
  current.minOrderQuantity === saved.minOrderQuantity
  && current.orderStep === saved.orderStep
  && current.priceUnit?.name === saved.priceUnit?.name
  && current.priceUnit?.baseQuantity === saved.priceUnit?.baseQuantity
  && areAvailabilitiesEqual(current.availability, saved.availability)
);
