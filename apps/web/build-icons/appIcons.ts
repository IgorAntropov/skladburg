export interface AppIconValue {
  fileName: string;
  hasBackground: boolean;
  purpose: 'any' | 'maskable';
  size: number;
  source: 'app-icon' | 'app-icon-maskable' | 'favicon';
}

export const ICON_SOURCES_DIRECTORY = 'build-icons/sources';

export const ICON_OUTPUT_DIRECTORY = 'public';

export const APP_ICONS: readonly AppIconValue[] = [
  { fileName: 'favicon.svg', hasBackground: false, purpose: 'any', size: 32, source: 'favicon' },
  { fileName: 'favicon-32.png', hasBackground: false, purpose: 'any', size: 32, source: 'favicon' },
  { fileName: 'apple-touch-icon.png', hasBackground: true, purpose: 'any', size: 180, source: 'app-icon' },
  { fileName: 'pwa-192.png', hasBackground: true, purpose: 'any', size: 192, source: 'app-icon' },
  { fileName: 'pwa-512.png', hasBackground: true, purpose: 'any', size: 512, source: 'app-icon' },
  { fileName: 'pwa-maskable-512.png', hasBackground: true, purpose: 'maskable', size: 512, source: 'app-icon-maskable' },
];

export const isManifestIcon = ({ fileName }: AppIconValue): boolean => fileName.startsWith('pwa-');

export const isVectorIcon = ({ fileName }: AppIconValue): boolean => fileName.endsWith('.svg');

export const getIconSizes = ({ size }: AppIconValue): string => `${String(size)}x${String(size)}`;
