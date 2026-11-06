import { ImportStatus } from '@skladburg/contracts/import/v1/import';

import type { IStateTransaction } from '../../state/index';

export const markImportedListingsUsed = (
  transaction: IStateTransaction,
  organizationId: string,
  listingIds: readonly string[],
): void => {
  const usedIds = new Set(listingIds);
  for (const record of transaction.listBy('importJobs', 'tenantId', organizationId)) {
    if (record.job.status !== ImportStatus.COMMITTED) {
      continue;
    }
    const matched = record.provenance.filter(entry => usedIds.has(entry.listingId)).map(entry => entry.listingId);
    const next = [...new Set([...record.usedListingIds, ...matched])];
    if (next.length !== record.usedListingIds.length) {
      transaction.put('importJobs', { ...record, usedListingIds: next });
    }
  }
};
