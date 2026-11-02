import { VatRate } from '@skladburg/contracts/catalog/v1/catalog';

export type VatDescriptionValue = { kind: 'none' } | { kind: 'rate'; percent: number };

export const describeVat = (vatRate: VatRate): undefined | VatDescriptionValue => {
  switch (vatRate) {
    case VatRate.VAT_RATE_10:
      return { kind: 'rate', percent: 10 };
    case VatRate.VAT_RATE_22:
      return { kind: 'rate', percent: 22 };
    case VatRate.VAT_RATE_NONE:
      return { kind: 'none' };
    case VatRate.VAT_RATE_UNSPECIFIED:
      return undefined;
  }
};
