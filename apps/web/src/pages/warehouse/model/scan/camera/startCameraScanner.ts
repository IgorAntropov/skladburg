import type {
  CameraDecoderRequestValue,
  CameraDecoderResponseValue,
} from './cameraDecoderTypes';

import { createCameraCodeGate } from './cameraCodes';
import {
  openCameraStream,
  stopCameraStream,
} from './openCameraStream';

export type CameraErrorValue = 'warehouseWork.cameraDenied' | 'warehouseWork.cameraFailed' | 'warehouseWork.cameraUnavailable';

interface CameraScannerOptionsValue {
  createWorker: () => Worker;
  onCode: (raw: string) => void;
  onError: (message: CameraErrorValue) => void;
  onReady: () => void;
  signal: AbortSignal;
  video: HTMLVideoElement;
}

const FRAME_DELAY_MS = 150;
const RESPONSE_TIMEOUT_MS = 15_000;
const MAX_FRAME_EDGE = 960;

const readCameraError = (error: unknown): CameraErrorValue => {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'warehouseWork.cameraDenied';
    }
    if (error.name === 'NotFoundError') {
      return 'warehouseWork.cameraUnavailable';
    }
  }
  return 'warehouseWork.cameraFailed';
};

export const startCameraScanner = async ({ createWorker, onCode, onError, onReady, signal, video }: CameraScannerOptionsValue):
Promise<void> => {
  const devices = navigator.mediaDevices;
  if (signal.aborted) {
    return;
  }
  if (!('mediaDevices' in navigator) || typeof devices.getUserMedia !== 'function') {
    onError('warehouseWork.cameraUnavailable');
    return;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) {
    onError('warehouseWork.cameraFailed');
    return;
  }

  const readNewCodes = createCameraCodeGate();
  let stream: MediaStream | undefined;
  let worker: undefined | Worker;
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let responseTimer: ReturnType<typeof setTimeout> | undefined;
  const session = { isClosed: false };
  const isSessionClosed = (): boolean => session.isClosed;

  const handleStop = (): void => {
    if (session.isClosed) {
      return;
    }
    session.isClosed = true;
    signal.removeEventListener('abort', handleStop);
    clearTimeout(frameTimer);
    clearTimeout(responseTimer);
    worker?.terminate();
    if (stream !== undefined) {
      for (const track of stream.getVideoTracks()) {
        track.removeEventListener('ended', handleFailure);
      }
      stopCameraStream(stream);
      video.srcObject = null;
    }
  };

  const handleError = (message: CameraErrorValue): void => {
    if (!session.isClosed) {
      handleStop();
      onError(message);
    }
  };

  const handleFailure = (): void => {
    handleError('warehouseWork.cameraFailed');
  };

  const send = (request: CameraDecoderRequestValue, transfer: Transferable[] = []): void => {
    responseTimer = setTimeout(handleFailure, RESPONSE_TIMEOUT_MS);
    worker?.postMessage(request, transfer);
  };

  const handleFrame = (): void => {
    const { videoHeight, videoWidth } = video;
    if (session.isClosed) {
      return;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || videoWidth === 0 || videoHeight === 0) {
      responseTimer ??= setTimeout(handleFailure, RESPONSE_TIMEOUT_MS);
      frameTimer = setTimeout(handleFrame, FRAME_DELAY_MS);
      return;
    }
    clearTimeout(responseTimer);
    const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(videoWidth, videoHeight));
    const width = Math.max(1, Math.round(videoWidth * scale));
    const height = Math.max(1, Math.round(videoHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    try {
      context.drawImage(video, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      send({ image, kind: 'frame' }, [image.data.buffer]);
    }
    catch {
      handleFailure();
    }
  };

  const handleMessage = ({ data }: MessageEvent<CameraDecoderResponseValue>): void => {
    if (session.isClosed) {
      return;
    }
    clearTimeout(responseTimer);
    responseTimer = undefined;
    if (data.kind === 'error') {
      handleFailure();
      return;
    }
    if (data.kind === 'ready') {
      onReady();
    }
    else {
      for (const code of readNewCodes(data.code === undefined ? [] : [data.code], performance.now())) {
        onCode(code);
      }
    }
    if (!isSessionClosed()) {
      frameTimer = setTimeout(handleFrame, FRAME_DELAY_MS);
    }
  };

  signal.addEventListener('abort', handleStop, { once: true });
  try {
    const camera = await openCameraStream(constraints => devices.getUserMedia(constraints), signal);
    if (session.isClosed) {
      stopCameraStream(camera);
      return;
    }
    stream = camera;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', handleFailure, { once: true });
    }
    video.srcObject = stream;
    responseTimer = setTimeout(handleFailure, RESPONSE_TIMEOUT_MS);
    await video.play();
    if (isSessionClosed()) {
      return;
    }
    clearTimeout(responseTimer);
    worker = createWorker();
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleFailure);
    worker.addEventListener('messageerror', handleFailure);
    send({ kind: 'prepare' });
  }
  catch (error) {
    handleError(readCameraError(error));
  }
};
