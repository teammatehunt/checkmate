import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import isEqual from 'lodash/isEqual';
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
