import { createContext } from 'react';

export type AnnounceFunction = (message: string) => void;

const announceWithoutProvider: AnnounceFunction = (message) => {
  console.log('> LiveRegionContext -> announceWithoutProvider:', { message });
};

export const LiveRegionContext = createContext<AnnounceFunction>(announceWithoutProvider);
