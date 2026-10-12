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

import { createWorldMaterialRegistry } from './createWorldMaterialRegistry';
import { WorldMaterialsContext } from './WorldMaterialsContext';

interface WorldMaterialsProviderProps {
  children: ReactNode;
  palette: WorldPaletteValue;
}

export const WorldMaterialsProvider = ({ children, palette }: WorldMaterialsProviderProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const [registry] = useState(() => createWorldMaterialRegistry(palette));

  const contextValue = useMemo((): WorldMaterialsContextValue => ({ palette, registry }), [palette, registry]);

  useEffect(() => {
    registry.applyPalette(palette);
    invalidate();
  }, [invalidate, palette, registry]);

  useEffect(() => {
    return () => {
      registry.dispose();
    };
  }, [registry]);

  return <WorldMaterialsContext value={contextValue}>{children}</WorldMaterialsContext>;
};
