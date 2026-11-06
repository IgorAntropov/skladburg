import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../../ports/index';

export interface DealReminderMarkValue {
  confirmationDueAtMs: number | undefined;
  counterOfferDueAtMs: number | undefined;
  id: string;
}

const isOptionalInstant = (instant: unknown): instant is null | number =>
  instant === null || (typeof instant === 'number' && Number.isSafeInteger(instant));

export const parseDealReminderMark = (stored: StoredRecordValue): DealReminderMarkValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored deal reminder mark must be a plain object');
  }

  const { confirmationDueAtMs, counterOfferDueAtMs, id } = stored;

  if (typeof id !== 'string' || !isOptionalInstant(confirmationDueAtMs) || !isOptionalInstant(counterOfferDueAtMs)) {
    throw new TypeError('Stored deal reminder mark has an unexpected shape');
  }

  return {
    confirmationDueAtMs: confirmationDueAtMs ?? undefined,
    counterOfferDueAtMs: counterOfferDueAtMs ?? undefined,
    id,
  };
};

export const serializeDealReminderMark = (record: DealReminderMarkValue): StoredObjectValue => ({
  confirmationDueAtMs: record.confirmationDueAtMs ?? null,
  counterOfferDueAtMs: record.counterOfferDueAtMs ?? null,
  id: record.id,
});
