import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import isEqual from 'lodash/isEqual';

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
