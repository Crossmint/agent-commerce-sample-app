"use client";

import * as React from "react";

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  /** True until the first load settles. */
  loading: boolean;
  /** True while any load is in flight. */
  refreshing: boolean;
  refetch: () => Promise<T | undefined>;
  /** Replace the data locally, for optimistic updates. */
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

export interface ResourceOptions<T> {
  /** Skip fetching when false. */
  enabled?: boolean;
  /** Poll every N ms while `shouldPoll(data)` returns true. */
  pollMs?: number;
  shouldPoll?: (data: T | undefined) => boolean;
}

/**
 * A small fetch-and-poll hook. No cache, no dedupe: the pages that use it are
 * short-lived and each mounts one of these per resource.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  { enabled = true, pollMs, shouldPoll }: ResourceOptions<T> = {},
): Resource<T> {
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<unknown>(undefined);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;
  const shouldPollRef = React.useRef(shouldPoll);
  shouldPollRef.current = shouldPoll;
  const dataRef = React.useRef<T | undefined>(undefined);
  const generation = React.useRef(0);

  const refetch = React.useCallback(async () => {
    const gen = ++generation.current;
    setRefreshing(true);
    try {
      const next = await fetcherRef.current();
      if (gen !== generation.current) return dataRef.current;
      dataRef.current = next;
      setData(next);
      setError(undefined);
      return next;
    } catch (e) {
      if (gen !== generation.current) return dataRef.current;
      setError(e);
      return dataRef.current;
    } finally {
      if (gen === generation.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  // Reset and load when deps change.
  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refetch();
    return () => {
      generation.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refetch, ...deps]);

  // Poll. A failed read counts as a tick too, so a blip does not stop the polling.
  React.useEffect(() => {
    if (!enabled || !pollMs) return;
    if (shouldPollRef.current && !shouldPollRef.current(data)) return;
    const t = setTimeout(() => void refetch(), pollMs);
    return () => clearTimeout(t);
  }, [enabled, pollMs, data, error, refetch]);

  const setDataExternal = React.useCallback<React.Dispatch<React.SetStateAction<T | undefined>>>((action) => {
    setData((prev) => {
      const next = typeof action === "function" ? (action as (p: T | undefined) => T | undefined)(prev) : action;
      dataRef.current = next;
      return next;
    });
  }, []);

  return { data, error, loading, refreshing, refetch, setData: setDataExternal };
}
