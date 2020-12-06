import React, {
  createContext,
  useContext,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';

export interface LocalStorageObject<T> {
  value: T;
  set(value: T): void;
  delete(): void;
}

export function useLocalStorageObject<T>(key: string, defaultValue: T) : LocalStorageObject<T> {
  const [value, set, _delete] = useLocalStorage<T>(key, defaultValue);
  return {value, set, delete: _delete};
}

export interface PuzzleContextType {
  vsplitter?: LocalStorageObject<number>,
  lhsplitter?: LocalStorageObject<number>,
  rhsplitter?: LocalStorageObject<number>,
}

const PuzzleContext = createContext({});

export const PuzzleContextProvider = ({children}) => {
  const ctxValue = {
    vsplitter: useLocalStorageObject('puzzlecontext/vsplitter', null),
    lhsplitter: useLocalStorageObject('puzzlecontext/lhsplitter', null),
    rhsplitter: useLocalStorageObject('puzzlecontext/rhsplitter', null),
  };
  return (
    <PuzzleContext.Provider value={ctxValue}>
      {children}
    </PuzzleContext.Provider>
  )
};
