"use client";

import { useMemo, useSyncExternalStore } from "react";

function getServerSnapshot() {
  return false;
}

export function useMediaQuery(query: string): boolean {
  const { subscribe, getSnapshot } = useMemo(() => {
    return {
      subscribe: (cb: () => void) => {
        if (typeof window === "undefined") return () => {};
        const mql = window.matchMedia(query);
        mql.addEventListener("change", cb);
        return () => mql.removeEventListener("change", cb);
      },
      getSnapshot: () => {
        if (typeof window === "undefined") return false;
        return window.matchMedia(query).matches;
      },
    };
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
