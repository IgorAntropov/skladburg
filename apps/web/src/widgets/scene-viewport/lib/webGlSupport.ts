import { createWebGlProbe } from './createWebGlProbe';

export const isWebGlSupported = createWebGlProbe(() => document.createElement('canvas'));
