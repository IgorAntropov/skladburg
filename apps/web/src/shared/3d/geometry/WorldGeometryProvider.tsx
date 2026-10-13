import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useEffect,
  useState,
} from 'react';

import { createWorldGeometryRegistry } from './createWorldGeometryRegistry';
import { WorldGeometryContext } from './WorldGeometryContext';

interface WorldGeometryProviderProps {
  children: ReactNode;
}

export const WorldGeometryProvider = ({ children }: WorldGeometryProviderProps): ReactElement => {
  const [registry] = useState(createWorldGeometryRegistry);

  useEffect(() => {
    return () => {
      registry.dispose();
    };
  }, [registry]);

  return <WorldGeometryContext value={registry}>{children}</WorldGeometryContext>;
};
