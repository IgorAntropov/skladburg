export type CanvasFactory = () => HTMLCanvasElement;

const probeWebGl = (createCanvas: CanvasFactory): boolean => {
  try {
    const canvas = createCanvas();
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');

    if (context === null) {
      return false;
    }

    context.getExtension('WEBGL_lose_context')?.loseContext();

    return true;
  }
  catch (error: unknown) {
    console.error('> createWebGlProbe -> probeWebGl:', { error });

    return false;
  }
};

export const createWebGlProbe = (createCanvas: CanvasFactory): () => boolean => {
  let isSupportConfirmed = false;

  return (): boolean => {
    isSupportConfirmed ||= probeWebGl(createCanvas);

    return isSupportConfirmed;
  };
};
