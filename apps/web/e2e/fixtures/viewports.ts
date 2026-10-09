export type TopBarLayoutValue = 'desktop' | 'phone' | 'tablet';

export interface ViewportScenarioValue {
  hasTouch: boolean;
  height: number;
  isMobile: boolean;
  layout: TopBarLayoutValue;
  name: string;
  width: number;
}

export const DESKTOP_VIEWPORT: ViewportScenarioValue = {
  hasTouch: false,
  height: 900,
  isMobile: false,
  layout: 'desktop',
  name: 'desktop 1440x900',
  width: 1440,
};

export const TABLET_VIEWPORT: ViewportScenarioValue = {
  hasTouch: false,
  height: 1180,
  isMobile: false,
  layout: 'tablet',
  name: 'tablet 820x1180',
  width: 820,
};

export const PHONE_VIEWPORT: ViewportScenarioValue = {
  hasTouch: true,
  height: 844,
  isMobile: true,
  layout: 'phone',
  name: 'phone 390x844',
  width: 390,
};

export const LAPTOP_VIEWPORT: ViewportScenarioValue = {
  hasTouch: false,
  height: 800,
  isMobile: false,
  layout: 'desktop',
  name: 'laptop 1280x800',
  width: 1280,
};

export const NARROW_PHONE_VIEWPORT: ViewportScenarioValue = {
  hasTouch: true,
  height: 740,
  isMobile: true,
  layout: 'phone',
  name: 'phone 360x740',
  width: 360,
};

export const VIEWPORT_SCENARIOS: readonly ViewportScenarioValue[] = [DESKTOP_VIEWPORT, TABLET_VIEWPORT, PHONE_VIEWPORT];

export const MENU_VIEWPORT_SCENARIOS: readonly ViewportScenarioValue[] = [
  DESKTOP_VIEWPORT,
  LAPTOP_VIEWPORT,
  PHONE_VIEWPORT,
  NARROW_PHONE_VIEWPORT,
];

export const PHONE_VIEWPORT_SCENARIOS: readonly ViewportScenarioValue[] = [PHONE_VIEWPORT, NARROW_PHONE_VIEWPORT];
