"use client";

import * as React from "react";

/**
 * Synchronizes local optimistic UI state with a server/parent prop without
 * triggering `react-hooks/set-state-in-effect` or render-time `setState`.
 *
 * When `propValue` changes reference/identity (`!Object.is`), the derived state
 * automatically resets to the incoming `propValue`. Pass primitive values for
 * scalar filters so unrelated re-renders do not reset local overrides.
 */
export function usePropSyncedState<T>(propValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<{ base: T; current: T }>(() => ({
    base: propValue,
    current: propValue,
  }));

  const value = Object.is(state.base, propValue) ? state.current : propValue;

  const setValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (updater) => {
      setState((prev) => {
        const active = Object.is(prev.base, propValue) ? prev.current : propValue;
        const next = typeof updater === "function" ? (updater as (p: T) => T)(active) : updater;
        return { base: propValue, current: next };
      });
    },
    [propValue]
  );

  return [value, setValue];
}
