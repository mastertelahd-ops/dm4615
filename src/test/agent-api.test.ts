import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentAuthError,
  AgentUnavailableError,
  DEFAULT_AGENT_URL,
  checkHealth,
  createAgentClient,
  isLoopback,
  normalizeUrl,
  testOltConnection,
} from "@/lib/agent-api";
import { DEMO_DATA, DEMO_LABEL } from "@/lib/demo-data";

afterEach(() => vi.unstubAllGlobals());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("agent api", () => {
  it("uses http://127.0.0.1:17861 as default URL", () => {
    expect(DEFAULT_AGENT_URL).toBe("http://127.0.0.1:17861");
    expect(isLoopback(DEFAULT_AGENT_URL)).toBe(true);
    expect(isLoopback("http://192.168.0.10:17861")).toBe(false);
    expect(normalizeUrl("ftp://x")).toBeNull();
  });
  it("sem agente: /health reporta offline (network)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const r = await checkHealth(DEFAULT_AGENT_URL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("network");
  });
  it("agente online: /health é público e retorna capabilities reais", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(json({ status: "ok", capabilities: ["gpon.onu.read", "ssh.handshake"] }));
    vi.stubGlobal("fetch", f);
    const r = await checkHealth(DEFAULT_AGENT_URL);
    expect(f.mock.calls[0]![0]).toBe("http://127.0.0.1:17861/health");
    expect(f.mock.calls[0]![1].headers).toBeUndefined();
    expect(r.ok && r.info.capabilities).toEqual(["gpon.onu.read"]);
    expect(r.ok && r.info.unknownCapabilities).toEqual(["ssh.handshake"]);
  });
  it("connection-test envia token no header, nunca na URL", async () => {
    const f = vi.fn().mockResolvedValue(json({ ssh: "ok" }));
    vi.stubGlobal("fetch", f);
    const r = await testOltConnection(DEFAULT_AGENT_URL, "secret");
    expect(r.ok).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("http://127.0.0.1:17861/olt/connection-test");
    expect(f.mock.calls[0]![1].method).toBe("POST");
    expect(f.mock.calls[0]![1].headers.Authorization).toBe("Bearer secret");
  });
  it("token inválido: connection-test e consultas reportam recusa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(json({}, 401))),
    );
    const r = await testOltConnection(DEFAULT_AGENT_URL, "bad");
    expect(!r.ok && r.reason).toBe("unauthorized");
    await expect(
      createAgentClient(DEFAULT_AGENT_URL, "bad", ["gpon.onu.read"]).gponOnus("1/1/2"),
    ).rejects.toBeInstanceOf(AgentAuthError);
  });
  it("capabilities ausentes: não chama o endpoint", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(
      createAgentClient(DEFAULT_AGENT_URL, "t", []).gponOnus("1/1/2"),
    ).rejects.toBeInstanceOf(AgentUnavailableError);
    expect(f).not.toHaveBeenCalled();
  });
  it("bloqueia PONs não validadas", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(
      createAgentClient(DEFAULT_AGENT_URL, "t", ["gpon.interface.read"]).gponInterface("1/1/1"),
    ).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("falha de consulta: HTTP 500 vira erro compreensível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));
    await expect(
      createAgentClient(DEFAULT_AGENT_URL, "t", ["gpon.interface.read"]).gponInterface("1/1/2"),
    ).rejects.toThrow("HTTP 500");
  });
  it("consulta bem-sucedida retorna raw e horário", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({
          command: "show interface gpon 1/1/2",
          collectedAt: "2026-11-15T01:00:00Z",
          raw: "ok",
        }),
      ),
    );
    const r = await createAgentClient(DEFAULT_AGENT_URL, "t", [
      "gpon.interface.read",
    ]).gponInterface("1/1/2");
    expect(r.raw).toBe("ok");
    expect(r.collectedAt).toBe("2026-11-15T01:00:00Z");
  });
  it("bloqueia comandos fora da allowlist e escrita", async () => {
    const c = createAgentClient(DEFAULT_AGENT_URL, "t", ["cli.read"]);
    await expect(c.cliRead("reboot")).rejects.toThrow();
    await expect(c.write("provision")).rejects.toThrow();
  });
  it("modo simulação: dados marcados e isolados", () => {
    expect(DEMO_LABEL).toBe("SIMULAÇÃO — NÃO SÃO DADOS DA OLT");
    expect(DEMO_DATA.simulated).toBe(true);
    expect(DEMO_DATA.onus.every((o) => o.serial.startsWith("DEMO"))).toBe(true);
  });
});
