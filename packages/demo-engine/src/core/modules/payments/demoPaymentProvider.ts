import type { IPaymentProvider } from '../../ports/paymentProvider';
import type { IRandom } from '../../ports/random';

const MINUTE_MS = 60_000;

export const createDemoPaymentProvider = (random: IRandom): IPaymentProvider => ({
  scheduleFunding: worldTimeMs => ({
    dueAtMs: worldTimeMs + (2 + random.nextInt(3)) * MINUTE_MS,
    reference: random.uuid(),
  }),
  schedulePayout: worldTimeMs => worldTimeMs + (1 + random.nextInt(2)) * MINUTE_MS,
});
