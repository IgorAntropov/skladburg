import type { Deal } from '@skladburg/contracts/deal/v1/deal';

export interface DealCommandContextValue {
  deal: Deal;
  onRefresh: () => void;
  onUpdated: (deal: Deal) => void;
}

export const dealCommandVersion = (deal: Deal, idempotencyKey: string): {
  dealId: string;
  expectedVersion: number;
  idempotencyKey: string;
} => ({ dealId: deal.id, expectedVersion: deal.version, idempotencyKey });

export const requireDealResult = ({ deal }: { deal?: Deal | undefined }): Deal => {
  if (deal === undefined) {
    throw new Error('Deal command response has no deal');
  }

  return deal;
};
