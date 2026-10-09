import type { ReactNode } from 'react';

export const hasSlot = (slot: ReactNode): boolean => {
  return slot !== undefined && slot !== null && slot !== false;
};
