import type {
  ReactElement,
  Ref,
  RefObject,
} from 'react';
import type { Object3D } from 'three';

import {
  CameraControls,
  CameraControlsImpl,
} from '@react-three/drei';
import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  OrthographicCamera,
  Vector3,
} from 'three';

import type {
  SceneBoundsValue,
  SceneViewBoxValue,
} from '../world/sceneBounds';
import type {
  CameraModeEventValue,
  CameraModeValue,
} from './cameraMode';
import type {
  CameraFitValue,
  FlyToOptionsValue,
  IIsometricCameraRig,
  ScenePointValue,
} from './cameraTypes';

import {
  CAMERA_SMOOTH_TIME_S,
  FOLLOW_FRAME_PRIORITY,
  ISOMETRIC_POLAR_RADIANS,
} from './cameraConstants';
import {
  INITIAL_CAMERA_MODE,
  reduceCameraMode,
} from './cameraMode';
import {
  azimuthForTurn,
  homeTurn,
  nextTurn,
} from './cameraTurns';
import {
  getZoomLimits,
  isViewAtFit,
  stepZoom,
} from './cameraZoom';
import {
  fitViewBoxToViewport,
  getCameraClipping,
} from './fitViewBoxToViewport';
import { FrameLimitedCameraControls } from './FrameLimitedCameraControls';

interface IsometricCameraRigProps {
  bounds: SceneBoundsValue;
  isReducedMotion: boolean;
  onJump?: (() => void) | undefined;
  ref?: Ref<IIsometricCameraRig> | undefined;
  viewBox: SceneViewBoxValue;
}

const { ACTION } = CameraControlsImpl;

const MOUSE_BUTTONS = {
  left: ACTION.SCREEN_PAN,
  middle: ACTION.NONE,
  right: ACTION.NONE,
  wheel: ACTION.ZOOM,
} as const;

const TOUCHES = {
  one: ACTION.TOUCH_SCREEN_PAN,
  three: ACTION.NONE,
  two: ACTION.TOUCH_ZOOM_TRUCK,
} as const;

const currentTarget = new Vector3();
const followPosition = new Vector3();

const readControls = (controlsRef: RefObject<CameraControlsImpl | null>): FrameLimitedCameraControls | undefined => {
  const controls = controlsRef.current;

  return controls instanceof FrameLimitedCameraControls ? controls : undefined;
};

export const IsometricCameraRig = ({
  bounds,
  isReducedMotion,
  onJump,
  ref,
  viewBox,
}: IsometricCameraRigProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const viewportWidth = useThree(state => state.size.width);
  const viewportHeight = useThree(state => state.size.height);

  const controlsRef = useRef<CameraControlsImpl>(null);
  const modeRef = useRef<CameraModeValue>(INITIAL_CAMERA_MODE);
  const turnRef = useRef(0);
  const followTargetRef = useRef<RefObject<null | Object3D> | undefined>(undefined);
  const fitRef = useRef<CameraFitValue | undefined>(undefined);

  const applyModeEvent = useCallback((event: CameraModeEventValue): void => {
    const nextMode = reduceCameraMode(modeRef.current, event);

    modeRef.current = nextMode;

    if (nextMode !== 'following') {
      followTargetRef.current = undefined;
    }
  }, []);

  const handleControlStart = useCallback((): void => {
    applyModeEvent({ kind: 'userGesture' });
  }, [applyModeEvent]);

  const handleRest = useCallback((): void => {
    applyModeEvent({ kind: 'rest' });
  }, [applyModeEvent]);

  useImperativeHandle(ref, (): IIsometricCameraRig => {
    const isTransitionEnabled = !isReducedMotion;

    const finishCommand = (): void => {
      if (isReducedMotion) {
        onJump?.();
      }

      invalidate();
    };

    return {
      flyTo: (target: ScenePointValue, options?: FlyToOptionsValue): void => {
        const controls = readControls(controlsRef);
        const fit = fitRef.current;

        if (controls === undefined || fit === undefined) {
          return;
        }

        console.log('> IsometricCameraRig -> flyTo:', { options, target });
        applyModeEvent({ kind: 'flyTo' });

        if (options?.zoom !== undefined) {
          void controls.zoomTo(fit.zoom * options.zoom, isTransitionEnabled);
        }

        void controls.moveTo(target.x, target.y, target.z, isTransitionEnabled);

        finishCommand();
      },
      follow: (target: RefObject<null | Object3D> | undefined): void => {
        console.log('> IsometricCameraRig -> follow:', { isFollowing: target !== undefined });
        followTargetRef.current = target;
        applyModeEvent({ kind: target === undefined ? 'unfollow' : 'follow' });
        invalidate();
      },
      home: (): void => {
        const controls = readControls(controlsRef);
        const fit = fitRef.current;

        if (controls === undefined || fit === undefined) {
          return;
        }

        turnRef.current = homeTurn(turnRef.current);
        console.log('> IsometricCameraRig -> home:', { turn: turnRef.current });
        applyModeEvent({ kind: 'home' });
        void controls.rotateTo(azimuthForTurn(turnRef.current), ISOMETRIC_POLAR_RADIANS, isTransitionEnabled);
        void controls.zoomTo(fit.zoom, isTransitionEnabled);
        void controls.moveTo(fit.target.x, fit.target.y, fit.target.z, isTransitionEnabled);
        finishCommand();
      },
      rotate: (direction: -1 | 1): void => {
        const controls = readControls(controlsRef);

        if (controls === undefined) {
          return;
        }

        turnRef.current = nextTurn(turnRef.current, direction);
        console.log('> IsometricCameraRig -> rotate:', { direction, turn: turnRef.current });
        applyModeEvent({ kind: 'rotate' });
        void controls.rotateTo(azimuthForTurn(turnRef.current), ISOMETRIC_POLAR_RADIANS, isTransitionEnabled);
        finishCommand();
      },
      zoom: (direction: -1 | 1): void => {
        const controls = readControls(controlsRef);

        if (controls === undefined) {
          return;
        }

        console.log('> IsometricCameraRig -> zoom:', { direction });
        applyModeEvent({ kind: 'zoom' });
        void controls.zoomTo(stepZoom(controls.zoomEnd, direction), isTransitionEnabled);
        finishCommand();
      },
    };
  }, [applyModeEvent, invalidate, isReducedMotion, onJump]);

  useLayoutEffect(() => {
    const controls = readControls(controlsRef);

    const controlledCamera = controls?.camera;

    if (controls === undefined || !(controlledCamera instanceof OrthographicCamera)) {
      return;
    }

    const fit = fitViewBoxToViewport({ viewBox, viewport: { height: viewportHeight, width: viewportWidth } });
    const clipping = getCameraClipping(viewBox);
    const limits = getZoomLimits(fit.zoom);
    const previousFit = fitRef.current;
    const isHome = previousFit === undefined
      || isViewAtFit({ fit: previousFit, target: controls.getTarget(currentTarget, true), zoom: controls.zoomEnd });

    controlledCamera.near = clipping.near;
    controlledCamera.far = clipping.far;
    controlledCamera.updateProjectionMatrix();

    controls.setGroundHeight(fit.target.y);
    controls.minZoom = limits.min;
    controls.maxZoom = limits.max;
    controls.setPanLimits({ bounds, fitZoom: fit.zoom });

    void controls.dollyTo(clipping.distance, false);

    if (previousFit === undefined) {
      void controls.rotateTo(azimuthForTurn(turnRef.current), ISOMETRIC_POLAR_RADIANS, false);
    }

    if (isHome) {
      void controls.moveTo(fit.target.x, fit.target.y, fit.target.z, false);
      void controls.zoomTo(fit.zoom, false);
    }
    else {
      void controls.zoomTo(controls.zoomEnd, false);
    }

    fitRef.current = fit;
    invalidate();
  }, [bounds, camera, invalidate, viewBox, viewportHeight, viewportWidth]);

  useFrame(() => {
    if (modeRef.current !== 'following') {
      return;
    }

    const followed = followTargetRef.current?.current;
    const controls = readControls(controlsRef);

    if (followed === undefined || followed === null || controls === undefined) {
      return;
    }

    followed.getWorldPosition(followPosition);
    controls.followPoint(followPosition.x, followPosition.y, followPosition.z);
  }, FOLLOW_FRAME_PRIORITY);

  return (
    <CameraControls
      dollyToCursor
      impl={FrameLimitedCameraControls}
      maxPolarAngle={ISOMETRIC_POLAR_RADIANS}
      minPolarAngle={ISOMETRIC_POLAR_RADIANS}
      mouseButtons={MOUSE_BUTTONS}
      onControlStart={handleControlStart}
      onRest={handleRest}
      onSleep={handleRest}
      ref={controlsRef}
      smoothTime={CAMERA_SMOOTH_TIME_S}
      touches={TOUCHES}
    />
  );
};
