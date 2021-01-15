import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import isEqual from 'lodash/isEqual';
import { useLocalStorage } from '@rehooks/local-storage';
import useSessionStorage from 'react-use/lib/useSessionStorage';

export interface LocalStorageObject<T> {
  value: T;
  set(value: T): void;
  delete(): void;
}

export function useLocalStorageObject<T>(key: string, defaultValue: T) : LocalStorageObject<T> {
  const [value, set, _delete] = useLocalStorage<T>(key, defaultValue);
  return {value, set, delete: _delete};
}

export function useDefaultLocalStorageObject<T>(key: string, defaultValue: T) : LocalStorageObject<T> {
  const [localValue, localSet, localDelete] = useLocalStorage<T>(key, defaultValue);
  const [sessionValue, sessionSet] = useSessionStorage<T>(key, localValue);
  const set = useCallback((value) => {
    localSet(value);
    sessionSet(value);
  }, []);
  const _delete = useCallback(() => {
    localDelete();
    sessionSet(defaultValue);
    sessionStorage.removeItem(key);
  }, [key, defaultValue]);
  const result = useMemo(() => ({
    value: sessionValue,
    set: set,
    delete: _delete,
  }), [sessionValue, set, _delete]);
  return result;
}

export const usePrevious = (value) => {
  const ref = useRef(null);
  const prev = ref.current;
  ref.current = value;
  return prev;
};

export const useDeepCompareValue = (value) => {
  const ref = useRef(value);
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
};

export const useDeepCompareEffect = (fn, deps) => {
  return useEffect(fn, [useDeepCompareValue(deps)]);
};

export const useDeepCompareMemo = (fn, deps) => {
  return useMemo(fn, useDeepCompareValue(deps));
};

export const useDeepCompareCallback = (fn, deps) => {
  return useCallback(fn, useDeepCompareValue(deps));
};
