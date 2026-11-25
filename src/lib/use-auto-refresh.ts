import { useEffect, useRef } from "react";

export const AUTO_REFRESH_MS = 30_000;

/** Executa `fn` a cada intervalo só com a aba visível; pausa quando oculta. Sem sobreposição. */
export function useAutoRefresh(enabled: boolean, fn: () => Promise<unknown>, ms = AUTO_REFRESH_MS) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let running = false;
    const tick = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await fnRef.current();
      } finally {
        running = false;
      }
    };
    const start = () => {
      if (!timer) timer = setInterval(tick, ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, ms]);
}
