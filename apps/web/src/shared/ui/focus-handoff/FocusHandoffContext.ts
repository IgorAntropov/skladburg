import { createContext } from 'react';

export interface IFocusHandoff {
  cancel: (key: string) => void;
  claim: (key: string) => boolean;
  request: (key: string) => void;
}

const handoffWithoutProvider: IFocusHandoff = {
  cancel: () => undefined,
  claim: () => false,
  request: (key) => {
    console.log('> FocusHandoffContext -> request:', { key });
  },
};

export const FocusHandoffContext = createContext<IFocusHandoff>(handoffWithoutProvider);
