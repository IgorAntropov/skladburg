export type TopBarLayoutValue = 'desktop' | 'phone' | 'tablet';

export interface ViewportScenarioValue {
  hasTouch: boolean;
  height: number;
  isMobile: boolean;
  layout: TopBarLayoutValue;
  name: string;
  width: number;
}

export const VIEWPORT_SCENARIOS: readonly ViewportScenarioValue[] = [
  {
    hasTouch: false,
    height: 900,
    isMobile: false,
    layout: 'desktop',
    name: 'desktop 1440x900',
    width: 1440,
  },
  {
    hasTouch: false,
    height: 1180,
    isMobile: false,
    layout: 'tablet',
    name: 'tablet 820x1180',
    width: 820,
  },
  {
    hasTouch: true,
    height: 844,
    isMobile: true,
    layout: 'phone',
    name: 'phone 390x844',
    width: 390,
  },
];
