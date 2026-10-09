import { createContext } from 'react';

const closeNothing = (): void => undefined;

export const DropdownMenuCloseContext = createContext<() => void>(closeNothing);
