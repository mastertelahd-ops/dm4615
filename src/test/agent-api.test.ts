import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHealth, createAgentClient, normalizeUrl, DEFAULT_AGENT_URL } from "@/lib/agent-api";

afterEach(() => vi.restoreAllMocks());

describe("agent api", () => {
  it("uses http://127.0.0.1:17861 as default URL", () => {
    expect(DEFAULT_AGENT_URL).toBe("http://127.0.0.1:17861");
  });
  it("rejects invalid URLs", () => {
    expect(normalizeUrl("ftp://x")).toBeNull();
  });
  it("reports offline when the agent is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const r = await checkHealth(DEFAULT_AGENT_URL, "t");
    expect(r.ok).toBe(false);
  });
  it("sends token as header, never in the URL", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok", capabilities: [] })));
    vi.stubGlobal("fetch", f);
    await checkHealth(DEFAULT_AGENT_URL, "secret");
    expect(f.mock.calls[0][0]).toBe("http://127.0.0.1:17861/health");
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
  });
  it("does not call endpoints the agent did not declare", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(createAgentClient(DEFAULT_AGENT_URL, "t", []).gponOnus("1/1/2")).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("blocks commands outside the read-only allowlist", async () => {
    await expect(createAgentClient(DEFAULT_AGENT_URL, "t", ["cli.read"]).cliRead("reboot")).rejects.toThrow();
  });
  it("blocks write operations", async () => {
    await expect(createAgentClient(DEFAULT_AGENT_URL, "t", []).write("provision")).rejects.toThrow();
  });
});
