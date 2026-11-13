interface ICameraStream {
  getTracks: () => readonly { stop: () => void }[];
}

const CONSTRAINTS = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, height: { ideal: 720 }, width: { ideal: 1280 } },
} satisfies MediaStreamConstraints;

export const stopCameraStream = (stream: ICameraStream): void => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

export const openCameraStream = <TStream extends ICameraStream>(
  request: (constraints: MediaStreamConstraints) => Promise<TStream>,
  signal: AbortSignal,
): Promise<TStream> => new Promise((resolve, reject) => {
  signal.throwIfAborted();
  const handleAbort = (): void => {
    reject(new DOMException('Camera request cancelled', 'AbortError'));
  };
  signal.addEventListener('abort', handleAbort, { once: true });

  const handleError = (error: unknown): void => {
    signal.removeEventListener('abort', handleAbort);
    reject(error instanceof Error ? error : new Error('Camera request failed'));
  };

  try {
    void request(CONSTRAINTS).then((stream) => {
      signal.removeEventListener('abort', handleAbort);
      if (signal.aborted) {
        stopCameraStream(stream);
      }
      else {
        resolve(stream);
      }
    }, handleError);
  }
  catch (error) {
    handleError(error);
  }
});
