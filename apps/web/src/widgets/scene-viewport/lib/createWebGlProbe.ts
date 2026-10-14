import { isSoftwareRendererName } from './isSoftwareRendererName';

export type CanvasFactory = () => HTMLCanvasElement;

export interface WebGlProbeResultValue {
  isSoftware: boolean;
  isSupported: boolean;
}

type ProbeContextValue = WebGL2RenderingContext | WebGLRenderingContext;

const STRICT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };

const openContext = (
  createCanvas: CanvasFactory,
  attributes: undefined | WebGLContextAttributes,
): null | ProbeContextValue => {
  const canvas = createCanvas();

  return canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
};

const releaseContext = (context: ProbeContextValue): void => {
  context.getExtension('WEBGL_lose_context')?.loseContext();
};

const readRendererName = (context: ProbeContextValue): string => {
  const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
  const parameter = debugInfo === null ? context.RENDERER : debugInfo.UNMASKED_RENDERER_WEBGL;
  const name: unknown = context.getParameter(parameter);

  return typeof name === 'string' ? name : '';
};

const probeWebGl = (createCanvas: CanvasFactory): WebGlProbeResultValue => {
  try {
    const strictContext = openContext(createCanvas, STRICT_CONTEXT_ATTRIBUTES);

    if (strictContext !== null) {
      const isSoftware = isSoftwareRendererName(readRendererName(strictContext));

      releaseContext(strictContext);

      return { isSoftware, isSupported: true };
    }

    const plainContext = openContext(createCanvas, undefined);

    if (plainContext === null) {
      return { isSoftware: false, isSupported: false };
    }

    releaseContext(plainContext);

    return { isSoftware: true, isSupported: true };
  }
  catch (error: unknown) {
    console.error('> createWebGlProbe -> probeWebGl:', { error });

    return { isSoftware: false, isSupported: false };
  }
};

export const createWebGlProbe = (createCanvas: CanvasFactory): () => WebGlProbeResultValue => {
  let confirmedResult: undefined | WebGlProbeResultValue;

  return (): WebGlProbeResultValue => {
    if (confirmedResult !== undefined) {
      return confirmedResult;
    }

    const result = probeWebGl(createCanvas);

    if (result.isSupported) {
      confirmedResult = result;
    }

    return result;
  };
};
