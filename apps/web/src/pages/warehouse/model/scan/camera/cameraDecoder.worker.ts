import { prepareZXingModule } from 'zxing-wasm/reader';
import readerUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

import type {
  CameraDecoderRequestValue,
  CameraDecoderResponseValue,
} from './cameraDecoderTypes';

import { readCameraCode } from './readCameraCodes';

const respond = (response: CameraDecoderResponseValue): void => {
  self.postMessage(response);
};

const handleMessage = async ({ data }: MessageEvent<CameraDecoderRequestValue>): Promise<void> => {
  try {
    if (data.kind === 'prepare') {
      await prepareZXingModule({ fireImmediately: true, overrides: { locateFile: () => readerUrl } });
      respond({ kind: 'ready' });
    }
    else {
      respond({ code: await readCameraCode(data.image), kind: 'frame' });
    }
  }
  catch {
    respond({ kind: 'error' });
  }
};

self.addEventListener('message', (event: MessageEvent<CameraDecoderRequestValue>): void => {
  void handleMessage(event);
});
