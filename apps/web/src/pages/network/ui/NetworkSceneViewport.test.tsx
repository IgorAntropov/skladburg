import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

import {
  act,
  render,
  screen,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NetworkSceneInteractionValue } from '../model/networkSceneInteraction';

import { useNetworkMapStore } from '../model/useNetworkMapStore';
import { NetworkSceneViewport } from './NetworkSceneViewport';

interface SceneMocksValue {
  interaction: NetworkSceneInteractionValue | undefined;
  navigate: Mock<(address: unknown) => void>;
}

const mocks = vi.hoisted((): SceneMocksValue => ({
  interaction: undefined,
  navigate: vi.fn<(address: unknown) => void>(),
}));

vi.mock('@/shared/routing', () => ({
  useNavigate: (): typeof mocks.navigate => mocks.navigate,
}));

vi.mock('@/widgets/scene-viewport', () => ({
  SceneViewport: ({ interaction }: { interaction: NetworkSceneInteractionValue }): ReactElement => {
    mocks.interaction = interaction;

    return <div data-testid="scene-viewport-mock" />;
  },
}));

const LABEL = 'scene';

const readInteraction = (): NetworkSceneInteractionValue => {
  const { interaction } = mocks;

  if (interaction === undefined) {
    throw new Error('The scene viewport did not receive the interaction');
  }

  return interaction;
};

describe('NetworkSceneViewport', () => {
  const onWorldSiteSelect = vi.fn<() => void>();

  beforeEach(() => {
    mocks.navigate.mockReset();
    onWorldSiteSelect.mockReset();
    useNetworkMapStore.setState({ focusRequest: undefined, hoveredId: undefined });
  });

  it('takes the selected target from the focus', () => {
    render(
      <NetworkSceneViewport
        focus={{ id: 'city-1', type: 'city' }}
        label={LABEL}
        onWorldSiteSelect={onWorldSiteSelect}
        sceneData={undefined}
      />,
    );

    expect(screen.getByTestId('scene-viewport-mock')).toBeDefined();
    expect(readInteraction().selected).toEqual({ id: 'city-1', kind: 'city' });
  });

  it('opens the site address and tells the page about a site selected in the world', () => {
    render(<NetworkSceneViewport focus={undefined} label={LABEL} onWorldSiteSelect={onWorldSiteSelect} sceneData={undefined} />);

    readInteraction().onSelect({ id: 'site-1', kind: 'site' });

    expect(mocks.navigate).toHaveBeenCalledWith({ kind: 'object', object: { id: 'site-1', type: 'site' } });
    expect(onWorldSiteSelect).toHaveBeenCalledTimes(1);
  });

  it('opens the city address without telling the page', () => {
    render(<NetworkSceneViewport focus={undefined} label={LABEL} onWorldSiteSelect={onWorldSiteSelect} sceneData={undefined} />);

    readInteraction().onSelect({ id: 'city-1', kind: 'city' });

    expect(mocks.navigate).toHaveBeenCalledWith({ kind: 'object', object: { id: 'city-1', type: 'city' } });
    expect(onWorldSiteSelect).not.toHaveBeenCalled();
  });

  it('writes the hover into the store and clears it only for the same id', () => {
    render(<NetworkSceneViewport focus={undefined} label={LABEL} onWorldSiteSelect={onWorldSiteSelect} sceneData={undefined} />);

    act(() => {
      readInteraction().onHoverStart('site-1');
    });
    expect(useNetworkMapStore.getState().hoveredId).toBe('site-1');
    expect(readInteraction().hoveredId).toBe('site-1');

    act(() => {
      readInteraction().onHoverEnd('site-2');
    });
    expect(useNetworkMapStore.getState().hoveredId).toBe('site-1');

    act(() => {
      readInteraction().onHoverEnd('site-1');
    });
    expect(useNetworkMapStore.getState().hoveredId).toBeUndefined();
  });
});
