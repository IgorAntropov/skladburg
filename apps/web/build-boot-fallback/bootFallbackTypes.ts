export interface BootFallbackColorsValue {
  background: string;
  badge: string;
  badgeIcon: string;
  button: string;
  buttonText: string;
  focus: string;
  text: string;
}

export interface BootFallbackMarkupOptionsValue {
  elementId: string;
  messages: BootFallbackMessagesValue;
}

export interface BootFallbackMessagesValue {
  message: string;
  reload: string;
}

export interface BootFallbackScriptOptionsValue {
  elementId: string;
  rootId: string;
}

export type BootFallbackThemeColorsValue = Readonly<Record<'dark' | 'light', BootFallbackColorsValue>>;
