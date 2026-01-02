import { useEffect, useRef } from "react";

/**
 * Simple polling hook.
 *
 * - Calls `callback` every `intervalMs` while `enabled` is true.
 * - Stops automatically on unmount or when `enabled` becomes false.
 * - Optionally pauses when the tab is hidden (if `pauseWhenHidden` is true).
 */
type UsePollingOptions = {
  enabled?: boolean;
  intervalMs: number;
  pauseWhenHidden?: boolean;
};

export function usePolling(
  callback: () => void | Promise<void>,
  { enabled = true, intervalMs, pauseWhenHidden = true }: UsePollingOptions
) {
  const savedCallback = useRef<typeof callback>(callback);

  // Keep latest callback without resetting the interval.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: number | undefined;

    function tick() {
      savedCallback.current();
    }

    function start() {
      if (intervalId != null) return;
      intervalId = window.setInterval(tick, intervalMs);
    }

    function stop() {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    }

    // Handle visibility change if required.
    function handleVisibilityChange() {
      if (!pauseWhenHidden) return;
      if (document.visibilityState === "hidden") {
        stop();
      } else if (document.visibilityState === "visible") {
        start();
      }
    }

    // Start immediately if tab is visible, or if we don't care about visibility.
    if (!pauseWhenHidden || document.visibilityState === "visible") {
      start();
    }

    if (pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Cleanup on unmount or when enabled/interval changes.
    return () => {
      stop();
      if (pauseWhenHidden) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [enabled, intervalMs, pauseWhenHidden]);
}
