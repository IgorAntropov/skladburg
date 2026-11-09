import type {
  JSHandle,
  Page,
} from '@playwright/test';

interface WorkerClockValue {
  nowMs: number;
}

const freezeWorkerClock = async (page: Page): Promise<JSHandle<WorkerClockValue>> => {
  const worker = page.workers().find(candidate => /\/assets\/worker-[\w-]+\.js$/u.test(new URL(candidate.url()).pathname));

  if (worker === undefined) {
    throw new Error('The demo engine Worker must be running before freezing its clock');
  }

  return worker.evaluateHandle((): WorkerClockValue => {
    const clock = { nowMs: performance.now() };
    Object.defineProperty(performance, 'now', { value: (): number => clock.nowMs });
    return clock;
  });
};

export const freezeEngineClock = async (...pages: Page[]): Promise<(elapsedMs: number) => Promise<void>> => {
  const clocks = await Promise.all(pages.map(freezeWorkerClock));

  return async (elapsedMs): Promise<void> => {
    await Promise.all(clocks.map(clock => clock.evaluate((workerClock, elapsedMs): void => {
      workerClock.nowMs += elapsedMs;
    }, elapsedMs)));
  };
};
