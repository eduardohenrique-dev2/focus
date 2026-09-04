import { useCallback, useEffect, useRef, useState } from "react";

/** Debounce a value so the consumer effect runs once per pause. */
export function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Track a "saving / saved / error" status with auto-fade. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((nextStatus: SaveStatus) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus(nextStatus);

    if (nextStatus === "saved" || nextStatus === "error") {
      timer.current = setTimeout(() => {
        setStatus("idle");
        timer.current = null;
      }, 2200);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { status, set };
}
