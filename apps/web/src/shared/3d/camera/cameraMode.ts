export type CameraModeEventValue
  = | { kind: 'flyTo' }
    | { kind: 'follow' }
    | { kind: 'home' }
    | { kind: 'rest' }
    | { kind: 'rotate' }
    | { kind: 'unfollow' }
    | { kind: 'userGesture' }
    | { kind: 'zoom' };

export type CameraModeValue = 'flying' | 'following' | 'free';

export const INITIAL_CAMERA_MODE: CameraModeValue = 'free';

export const reduceCameraMode = (state: CameraModeValue, event: CameraModeEventValue): CameraModeValue => {
  switch (event.kind) {
    case 'flyTo':
      return 'flying';
    case 'follow':
      return 'following';
    case 'home':
    case 'userGesture':
      return 'free';
    case 'rest':
      return state === 'flying' ? 'free' : state;
    case 'rotate':
    case 'zoom':
      return state;
    case 'unfollow':
      return state === 'following' ? 'free' : state;
  }
};
