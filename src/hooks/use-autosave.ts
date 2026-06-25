import { useEffect, useRef, useState } from "react";

/** Debounce a value so the consumer effect runs once per pause. */
export function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Track a "saving / saved / error" status with auto-fade. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (s: SaveStatus) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus(s);
    if (s === "saved" || s === "error") {
      timer.current = setTimeout(() => setStatus("idle"), 2200);
    }
  };
  return { status, set };
}
