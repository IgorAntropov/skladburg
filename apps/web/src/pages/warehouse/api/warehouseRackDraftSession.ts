import type { MessageInitShape } from '@bufbuild/protobuf';
import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { Client } from '@connectrpc/connect';
import type {
  PutWarehouseLayoutDraftRequestSchema,
  WarehouseLayoutSessionService,
} from '@skladburg/contracts/wms/v1/layout_session';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { EntityKindSchema } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import {
  createIdempotencyKey,
  parseApiError,
} from '@/shared/api';

import type { WarehouseRackPlacementValue } from '../model/warehouseRackPlacement';

export interface PublishedRackDraftValue {
  draft: WarehouseRackPlacementValue;
  layoutSessionId: string;
}

type DraftCallValue = DraftScopeValue & { idempotencyKey: string };

type DraftLayoutClientValue = Pick<Client<typeof WarehouseLayoutSessionService>,
  'openWarehouseLayoutSession' | 'putWarehouseLayoutDraft' | 'releaseWarehouseLayoutSession' | 'renewWarehouseLayoutSession'>;

interface DraftLeaseValue extends DraftScopeValue {
  expiresAtMs: number;
  layoutSessionId: string;
}
type DraftScopeValue = Pick<WarehouseRackPlacementValue, 'warehouseId' | 'zoneId'>;
interface IWarehouseRackDraftSession {
  commit: <T>(save: () => Promise<T>) => Promise<T>;
  read: () => WarehouseRackDraftStateValue;
  release: () => Promise<void>;
  retry: () => void;
  select: (draft: undefined | WarehouseRackPlacementValue) => void;
  subscribe: (notify: () => void) => () => void;
}
interface PublicationValue {
  draft: WarehouseRackPlacementValue;
  request: MessageInitShape<typeof PutWarehouseLayoutDraftRequestSchema>;
}
interface WarehouseRackDraftStateValue {
  error: Error | null;
  isExpired: boolean;
  isPublishing: boolean;
  published: PublishedRackDraftValue | undefined;
  zoneId: string | undefined;
}

const COALESCE_MS = 100;
const RENEW_MS = 30_000;
const RETRY_RENEW_MS = 5_000;
const RELEASE_TIMEOUT_MS = 3_000;
const DISABLED_DEADLINE = Infinity;
const warehouseZoneEntity = EntityKindSchema.values.find(kind => kind.localName === 'WAREHOUSE_STORAGE_ZONE')?.number;
const EMPTY_STATE: WarehouseRackDraftStateValue = {
  error: null,
  isExpired: false,
  isPublishing: false,
  published: undefined,
  zoneId: undefined,
};

const readDeadline = (expiresAt: Timestamp | undefined): number => expiresAt === undefined ? 0 : timestampMs(expiresAt);

const makeCall = ({ warehouseId, zoneId }: DraftScopeValue): DraftCallValue => ({
  idempotencyKey: createIdempotencyKey(),
  warehouseId,
  zoneId,
});

export const createWarehouseRackDraftSession = (client: DraftLayoutClientValue): IWarehouseRackDraftSession => {
  const subscribers = new Set<() => void>();
  let snapshot = EMPTY_STATE;
  let desired: undefined | WarehouseRackPlacementValue;
  let lease: DraftLeaseValue | undefined;
  let draftRevision = 0;
  let opening: DraftCallValue | undefined;
  let publishing: PublicationValue | undefined;
  let renewing: DraftCallValue | undefined;
  let publishAt = DISABLED_DEADLINE;
  let renewAt = DISABLED_DEADLINE;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let closing: Promise<void> | undefined;

  const notify = (change: Partial<WarehouseRackDraftStateValue>): void => {
    snapshot = { ...snapshot, ...change };
    for (const subscriber of subscribers) {
      subscriber();
    }
  };

  const resetLease = (error: Error | null, isExpired = false): void => {
    lease = undefined;
    opening = undefined;
    publishing = undefined;
    renewing = undefined;
    draftRevision = 0;
    renewAt = DISABLED_DEADLINE;
    publishAt = DISABLED_DEADLINE;
    notify({ ...EMPTY_STATE, error, isExpired });
  };

  const open = async (draft: WarehouseRackPlacementValue): Promise<void> => {
    opening ??= makeCall(draft);
    const { expiresAt, layoutSessionId } = await client.openWarehouseLayoutSession(opening);
    lease = { expiresAtMs: readDeadline(expiresAt), layoutSessionId, warehouseId: opening.warehouseId, zoneId: opening.zoneId };
    opening = undefined;
    renewAt = Date.now() + RENEW_MS;
    notify({ zoneId: lease.zoneId });
  };

  const renew = async (current: DraftLeaseValue): Promise<void> => {
    renewing ??= makeCall(current);
    try {
      const { expiresAt } = await client.renewWarehouseLayoutSession({ ...renewing, layoutSessionId: current.layoutSessionId });
      lease = { ...current, expiresAtMs: readDeadline(expiresAt) };
      renewing = undefined;
      renewAt = Date.now() + RENEW_MS;
    }
    catch (error) {
      if (!parseApiError(error).isRetryable) {
        renewAt = DISABLED_DEADLINE;
        throw error;
      }

      renewAt = Date.now() + RETRY_RENEW_MS;
    }
  };

  const publish = async (draft: WarehouseRackPlacementValue, current: DraftLeaseValue): Promise<void> => {
    publishing ??= {
      draft,
      request: {
        ...makeCall(draft),
        cells: [...draft.cells],
        expectedDraftRevision: draftRevision,
        expectedRevision: draft.expectedRevision,
        layoutSessionId: current.layoutSessionId,
        rowId: draft.rowId,
      },
    };
    const { draftRevision: nextDraftRevision } = await client.putWarehouseLayoutDraft(publishing.request);
    draftRevision = nextDraftRevision;
    const published = { draft: publishing.draft, layoutSessionId: current.layoutSessionId };
    publishing = undefined;
    const isAnotherDraftQueued = desired !== undefined && desired !== published.draft;

    if (!isAnotherDraftQueued) {
      publishAt = DISABLED_DEADLINE;
    }

    notify({ error: null, isPublishing: isAnotherDraftQueued, published });
  };

  const clearTimer = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };

  const handleFailure = (error: unknown, attempted?: WarehouseRackPlacementValue): void => {
    const problem = error instanceof Error ? error : new Error();
    const { code, isRetryable, params } = parseApiError(error);
    if (code === ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID) {
      resetLease(problem);

      return;
    }
    if (!isRetryable) {
      opening = undefined;
      publishing = undefined;
    }

    if (params.case === 'versionConflict' && params.value.entity === warehouseZoneEntity
      && params.value.currentVersion >= 0) {
      draftRevision = params.value.currentVersion;
    }
    if (attempted !== undefined && attempted !== desired && code !== ErrorCode.VERSION_CONFLICT) {
      return;
    }
    publishAt = DISABLED_DEADLINE;
    notify({ error: problem, isPublishing: false });
  };

  const run = <T>(execute: () => Promise<T>): Promise<T> => {
    clearTimer();
    const previous = inFlight;
    const operation = (async (): Promise<T> => {
      await previous;

      return execute();
    })();
    const settled = operation.then(() => undefined, () => undefined);
    inFlight = settled;
    void settled.then(() => {
      if (inFlight === settled) {
        inFlight = undefined;
        schedule();
      }
    });

    return operation;
  };

  const tick = (): void => {
    const current = lease;
    const now = Date.now();
    if (current !== undefined && now >= current.expiresAtMs) {
      resetLease(null, true);

      return;
    }
    if (current !== undefined && now >= renewAt) {
      void run(() => renew(current)).catch(handleFailure);

      return;
    }

    const draft = desired;
    if (draft !== undefined && now >= publishAt) {
      void run(() => current === undefined ? open(draft) : publish(draft, current)).catch((error: unknown) => {
        handleFailure(error, draft);
      });
    }
  };

  function schedule(): void {
    clearTimer();
    if (inFlight !== undefined || closing !== undefined) {
      return;
    }
    const deadline = Math.min(publishAt, renewAt, lease?.expiresAtMs ?? DISABLED_DEADLINE);
    if (Number.isFinite(deadline)) {
      timer = setTimeout(tick, Math.max(0, deadline - Date.now()));
    }
  }

  const select = (draft: undefined | WarehouseRackPlacementValue): void => {
    if (closing !== undefined) {
      return;
    }
    desired = draft;
    const isPublishing = draft !== undefined && (draft !== snapshot.published?.draft || publishing !== undefined);
    publishAt = isPublishing ? Date.now() + COALESCE_MS : DISABLED_DEADLINE;
    notify({ error: null, isExpired: false, isPublishing });
    schedule();
  };

  const commit = <T>(save: () => Promise<T>): Promise<T> => run(async () => {
    try {
      const saved = await save();
      desired = undefined;
      resetLease(null);

      return saved;
    }
    catch (error) {
      if (parseApiError(error).code === ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID) {
        resetLease(error instanceof Error ? error : new Error());
      }

      throw error;
    }
  });

  const release = (): Promise<void> => {
    if (closing !== undefined) {
      return closing;
    }
    desired = undefined;
    publishAt = DISABLED_DEADLINE;
    closing = run(async () => {
      const current = lease;
      const uncertainOpen = opening;
      resetLease(null);
      const scope = current ?? uncertainOpen;
      if (scope === undefined) {
        return;
      }
      const recovered = current ?? (uncertainOpen === undefined
        ? undefined
        : await client.openWarehouseLayoutSession(uncertainOpen, { timeoutMs: RELEASE_TIMEOUT_MS }).catch(() => undefined));
      if (recovered !== undefined) {
        await client.releaseWarehouseLayoutSession(
          { ...makeCall(scope), layoutSessionId: recovered.layoutSessionId },
          { timeoutMs: RELEASE_TIMEOUT_MS },
        ).catch(() => undefined);
      }
    }).finally(() => {
      closing = undefined;
    });

    return closing;
  };

  const subscribe = (notifyChange: () => void): (() => void) => {
    subscribers.add(notifyChange);

    return (): void => {
      subscribers.delete(notifyChange);
    };
  };

  const retry = (): void => {
    select(desired);
  };

  return { commit, read: () => snapshot, release, retry, select, subscribe };
};
