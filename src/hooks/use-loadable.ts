import { useCallback, useEffect, useRef, useState } from "react";
import { describeFailure, type LoadFailure } from "../lib/api";
export type Loadable<T> = {
  state: "loading" | "ready" | "error";
  data: T | null;
  error: LoadFailure | null;
  retry: () => void;
};
/** Scoped results cannot cross account changes; later requests always win. */
export function useLoadable<T>(key: string | null, loader: () => Promise<T>): Loadable<T> {
  const load = useRef(loader);
  load.current = loader;
  const sequence = useRef(0);
  const [result, setResult] = useState<{
    key: string | null;
    state: Loadable<T>["state"];
    data: T | null;
    error: LoadFailure | null;
  }>({ key: null, state: "loading", data: null, error: null });
  const run = useCallback(() => {
    const request = ++sequence.current;
    if (!key) return;
    setResult({ key, state: "loading", data: null, error: null });
    void load.current().then(
      (data) => {
        if (sequence.current === request) setResult({ key, state: "ready", data, error: null });
      },
      (error) => {
        if (sequence.current === request)
          setResult({ key, state: "error", data: null, error: describeFailure(error) });
      },
    );
  }, [key]);
  useEffect(() => {
    run();
    const resume = () => {
      if (document.visibilityState !== "hidden") run();
    };
    window.addEventListener("online", run);
    window.addEventListener("paaipe:resume", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      ++sequence.current;
      window.removeEventListener("online", run);
      window.removeEventListener("paaipe:resume", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [run]);
  return result.key === key
    ? { ...result, retry: run }
    : { state: "loading", data: null, error: null, retry: run };
}
