import type { Event } from '@skladburg/contracts/event/v1/event';

import type { IDemoEngine } from '../../core/engine/index';
import type { CoreModuleValue } from '../hostTypes';

import { createEngine } from '../../core/engine/createEngine';

export interface EngineProbeValue {
  checkpointCount: () => number;
  emitDuring: (kind: 'handle' | 'tick', channel: string, batches: readonly (readonly Event[])[]) => void;
  engine: IDemoEngine;
  handleCount: () => number;
  holdHandle: () => (() => void);
  holdTick: () => (() => void);
  listenerCount: (channel: string) => number;
  resetEpochs: () => readonly string[];
  tickCount: () => number;
}

interface PlannedEmissionValue {
  batches: readonly (readonly Event[])[];
  channel: string;
  kind: 'handle' | 'tick';
}

export const createEngineProbe = (inner: IDemoEngine): EngineProbeValue => {
  const listeners = new Map<string, Set<(events: readonly Event[]) => void>>();
  const resetEpochs: string[] = [];
  const planned: PlannedEmissionValue[] = [];
  let handles = 0;
  let ticks = 0;
  let checkpoints = 0;
  let handleGate: Promise<void> | undefined;
  let tickGate: Promise<void> | undefined;

  const emit = (channel: string, events: readonly Event[]): void => {
    for (const listener of [...listeners.get(channel) ?? []]) {
      listener(events);
    }
  };

  const runPlanned = (kind: 'handle' | 'tick'): void => {
    for (const emission of planned.filter(candidate => candidate.kind === kind)) {
      planned.splice(planned.indexOf(emission), 1);

      for (const batch of emission.batches) {
        emit(emission.channel, batch);
      }
    }
  };

  const createHold = (assign: (gate: Promise<void> | undefined) => void): (() => void) => {
    let release: () => void = () => undefined;
    assign(new Promise<void>((resolve) => {
      release = resolve;
    }));

    return () => {
      assign(undefined);
      release();
    };
  };

  const engine: IDemoEngine = {
    checkpoint: () => {
      checkpoints += 1;

      return inner.checkpoint();
    },
    epoch: () => inner.epoch(),
    getClockSnapshot: () => inner.getClockSnapshot(),
    handle: async (request) => {
      handles += 1;

      if (handleGate !== undefined) {
        await handleGate;
      }

      const response = await inner.handle(request);
      runPlanned('handle');

      return response;
    },
    listPersonas: () => inner.listPersonas(),
    reset: (epoch) => {
      resetEpochs.push(epoch);

      return inner.reset(epoch);
    },
    subscribe: (channel, headers, listener) => {
      const result = inner.subscribe(channel, headers, listener);

      if (result.kind === 'denied') {
        return result;
      }

      const set = listeners.get(channel) ?? new Set<(events: readonly Event[]) => void>();
      set.add(listener);
      listeners.set(channel, set);

      return {
        ...result,
        unsubscribe: () => {
          set.delete(listener);
          result.unsubscribe();
        },
      };
    },
    tick: async () => {
      ticks += 1;

      if (tickGate !== undefined) {
        await tickGate;
      }

      await inner.tick();
      runPlanned('tick');
    },
  };

  return {
    checkpointCount: () => checkpoints,
    emitDuring: (kind, channel, batches) => {
      planned.push({ batches, channel, kind });
    },
    engine,
    handleCount: () => handles,
    holdHandle: () => createHold((gate) => {
      handleGate = gate;
    }),
    holdTick: () => createHold((gate) => {
      tickGate = gate;
    }),
    listenerCount: channel => listeners.get(channel)?.size ?? 0,
    resetEpochs: () => resetEpochs,
    tickCount: () => ticks,
  };
};

export const createProbeLoader = (probes: EngineProbeValue[]): (() => Promise<CoreModuleValue>) => () => Promise.resolve({
  createEngine: async (options) => {
    const probe = createEngineProbe(await createEngine(options));
    probes.push(probe);

    return probe.engine;
  },
});
