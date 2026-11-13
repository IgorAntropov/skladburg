import type { AppAddressValue } from '@/shared/routing';

export type PrintPageValue = {
  address?: AppAddressValue | undefined;
  heading: string;
} & (
  | { code: string; details: readonly (PrintDetailValue | string)[]; kind: 'unit' }
  | { code: string; details: readonly string[]; kind: 'cell' | 'item' }
  | { details: readonly string[]; kind: 'document' }
);

interface PrintDetailValue {
  label: string;
  value: string;
}
