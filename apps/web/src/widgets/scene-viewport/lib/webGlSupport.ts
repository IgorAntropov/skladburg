import { createWebGlProbe } from './createWebGlProbe';

const probeWebGlSupport = createWebGlProbe(() => document.createElement('canvas'));

export const isSoftwareRenderer = (): boolean => probeWebGlSupport().isSoftware;

export const isWebGlSupported = (): boolean => probeWebGlSupport().isSupported;
