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
  discord_server_id: null,
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
