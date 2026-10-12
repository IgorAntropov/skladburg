import type {
  ReactElement,
  ReactNode,
} from 'react';

export type SceneStateValue = 'error' | 'loading' | 'off' | 'ready';

interface SceneFrameProps {
  children: ReactNode;
  sceneState: SceneStateValue;
}

const FRAME_CLASS_NAME = 'group relative size-full overflow-hidden bg-canvas';

export const SceneFrame = ({ children, sceneState }: SceneFrameProps): ReactElement => {
  return (
    <div className={FRAME_CLASS_NAME} data-scene-state={sceneState} data-testid="scene-viewport">
      {children}
    </div>
  );
};
