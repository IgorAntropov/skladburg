export type CameraDecoderRequestValue = { image: ImageData; kind: 'frame' } | { kind: 'prepare' };

export type CameraDecoderResponseValue = { code: string | undefined; kind: 'frame' } | { kind: 'error' } | { kind: 'ready' };
