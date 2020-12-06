import React, {
  createContext,
  useContext,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';

import * as Model from 'components/model';

export interface LocalStorageObject<T> {
  value: T;
  set(value: T): void;
  delete(): void;
}

export function useLocalStorageObject<T>(key: string, defaultValue: T) : LocalStorageObject<T> {
  const [value, set, _delete] = useLocalStorage<T>(key, defaultValue);
  return {value, set, delete: _delete};
}

export interface SiteContextType extends Model.HuntConfig {
}

export const SiteContext = createContext<SiteContextType>({
  domain: '',
  auto_assign_puzzles_to_meta: true,
});

export const SiteContextProvider = ({huntConfig, children}) => {
  const ctxValue = {
    ...huntConfig,
  };
  return (
    <SiteContext.Provider value={ctxValue}>
      {children}
    </SiteContext.Provider>
  )
};

export interface PuzzleContextType {
  vsplitter?: LocalStorageObject<number>,
  lhsplitter?: LocalStorageObject<number>,
  rhsplitter?: LocalStorageObject<number>,
}

export const PuzzleContext = createContext<PuzzleContextType>({});

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
