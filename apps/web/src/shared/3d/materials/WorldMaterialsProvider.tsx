import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';
import type { WorldMaterialsContextValue } from './WorldMaterialsContext';

import { createWorldGlowMaterialRegistry } from './createWorldGlowMaterialRegistry';
import { createWorldMaterialRegistry } from './createWorldMaterialRegistry';
import { WorldMaterialsContext } from './WorldMaterialsContext';

interface WorldMaterialsProviderProps {
  children: ReactNode;
  palette: WorldPaletteValue;
}

export const WorldMaterialsProvider = ({ children, palette }: WorldMaterialsProviderProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const [registry] = useState(() => createWorldMaterialRegistry(palette));
  const [glow] = useState(() => createWorldGlowMaterialRegistry(palette));

  const contextValue = useMemo((): WorldMaterialsContextValue => ({ glow, palette, registry }), [glow, palette, registry]);

  useEffect(() => {
    registry.applyPalette(palette);
    glow.applyPalette(palette);
    invalidate();
  }, [glow, invalidate, palette, registry]);

  useEffect(() => {
    return () => {
      registry.dispose();
      glow.dispose();
    };
  }, [glow, registry]);

  return <WorldMaterialsContext value={contextValue}>{children}</WorldMaterialsContext>;
};
