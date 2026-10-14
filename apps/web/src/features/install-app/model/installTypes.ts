export interface BeforeInstallPromptEventValue extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface IDisplayModeQuery {
  addEventListener: (type: 'change', listener: () => void) => void;
  readonly matches: boolean;
}

export interface IInstallPromptSource {
  getMode: () => InstallModeValue;
  prompt: () => Promise<InstallPromptOutcomeValue>;
  subscribe: (listener: () => void) => () => void;
}

export interface IInstallWindow {
  addEventListener: (type: 'appinstalled' | 'beforeinstallprompt', listener: (event: Event) => void) => void;
  matchMedia: ((query: string) => IDisplayModeQuery) | undefined;
  navigator: {
    readonly maxTouchPoints: number;
    readonly standalone?: boolean | undefined;
    readonly userAgent: string;
  };
}

export interface InstallEnvironmentValue {
  hasDeferredPrompt: boolean;
  isStandalone: boolean;
  maxTouchPoints: number;
  userAgent: string;
}

export type InstallModeValue = 'installed' | 'instructions' | 'prompt' | 'unavailable';

export type InstallPromptOutcomeValue = 'accepted' | 'dismissed' | 'unavailable';
