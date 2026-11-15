import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

describe("auto refresh", () => {
  it("chama a cada intervalo e pausa com aba oculta", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(undefined);
    let vis = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    const { unmount } = renderHook(() => useAutoRefresh(true, fn, 1000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    vis = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
    vi.useRealTimers();
  });
});
