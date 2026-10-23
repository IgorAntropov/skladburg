export const VIEWPORT_RECT = {
  bottom: 900,
  height: 900,
  left: 0,
  right: 1440,
  toJSON: (): string => '',
  top: 0,
  width: 1440,
  x: 0,
  y: 0,
};

export class ImmediateResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {
    return undefined;
  }

  observe(target: Element): void {
    this.callback([{ contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this);
  }

  unobserve(): void {
    return undefined;
  }
}

export const createFakeRenderer = (domElement: unknown): Record<string, unknown> => ({
  capabilities: {},
  compile: (): void => undefined,
  compileAsync: (): Promise<void> => Promise.resolve(),
  dispose: (): void => undefined,
  domElement,
  extensions: {},
  forceContextLoss: (): void => undefined,
  getContext: (): Record<string, never> => ({}),
  info: { autoReset: true, reset: (): void => undefined },
  outputColorSpace: '',
  render: (): void => undefined,
  setClearColor: (): void => undefined,
  setPixelRatio: (): void => undefined,
  setSize: (): void => undefined,
  shadowMap: {},
  toneMapping: 0,
  toneMappingExposure: 1,
  xr: {
    addEventListener: (): void => undefined,
    enabled: false,
    removeEventListener: (): void => undefined,
    setPoseTarget: (): void => undefined,
  },
});
