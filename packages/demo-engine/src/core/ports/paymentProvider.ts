export interface IPaymentProvider {
  scheduleFunding: (worldTimeMs: number) => { dueAtMs: number; reference: string };
  schedulePayout: (worldTimeMs: number) => number;
}
