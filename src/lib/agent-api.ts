// Cliente tipado do agente local Windows. O token é passado por chamada e
// nunca é gravado (localStorage, URL, logs, console). Apenas a URL pode ser salva.
export const DEFAULT_AGENT_URL = "http://127.0.0.1:17861";
export const AGENT_URL_STORAGE_KEY = "dm4615.agentUrl";

/** Portas físicas identificadas no chassi. A coleta só será considerada válida após resposta individual da OLT. */
export const VALIDATED_PON = "1/1/2";
export const PON_INVENTORY = Array.from({ length: 16 }, (_, i) => `1/1/${i + 1}`);

export type Capability = "gpon.interface.read" | "gpon.onu.read" | "cli.read";

/** Rotas documentadas. Só são chamadas se /health declarar a capability. */
export const AGENT_ROUTES: Record<
  Capability,
  { method: "GET" | "POST"; path: string; description: string }
> = {
  "gpon.interface.read": {
    method: "GET",
    path: "/olt/gpon/interface?pon=1/1/2",
    description: "show interface gpon 1/1/2",
  },
  "gpon.onu.read": {
    method: "GET",
    path: "/olt/gpon/onu?pon=1/1/2",
    description: "show interface gpon 1/1/2 onu",
  },
  "cli.read": {
    method: "POST",
    path: "/olt/cli/read",
    description: "Comandos da allowlist somente leitura",
  },
};

/** Comandos permitidos no terminal. Nada de escrita/config/reboot. */
export const READ_ONLY_COMMANDS = [
  "show interface gpon 1/1/2",
  "show interface gpon 1/1/2 onu",
] as const;

export const WRITE_OPERATIONS_ENABLED = false;

export interface HealthInfo {
  status: string;
  version?: string | undefined;
  agent?: string | undefined;
  capabilities: Capability[];
  /** Capabilities anunciadas que o painel não conhece (exibidas, nunca chamadas). */
  unknownCapabilities: string[];
}
export interface CollectResult {
  command: string;
  collectedAt: string;
  raw: string;
  parsed?: unknown;
}

export type FailReason =
  "invalid-url" | "timeout" | "network" | "unauthorized" | "http" | "bad-response";

export type HealthResult =
  | { ok: true; info: HealthInfo; latencyMs: number }
  | { ok: false; reason: FailReason; message: string };

export type ConnectionTestResult =
  | { ok: true; body: Record<string, unknown>; latencyMs: number }
  | { ok: false; reason: FailReason | "no-token"; message: string };

export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** O agente deve ficar restrito a loopback. */
export function isLoopback(url: string): boolean {
  const base = normalizeUrl(url);
  if (!base) return false;
  const h = new URL(base).hostname;
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]";
}

const NETWORK_MSG =
  "Agente inacessível: verifique se o serviço está rodando nesta máquina e se libera CORS e Access-Control-Allow-Private-Network para esta origem.";

async function timedFetch(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function fetchFailure(e: unknown, ms: number): { reason: FailReason; message: string } {
  if (e instanceof DOMException && e.name === "AbortError")
    return { reason: "timeout", message: `O agente não respondeu em ${ms / 1000} segundos.` };
  return { reason: "network", message: NETWORK_MSG };
}

/** GET /health é público: não envia token. */
export async function checkHealth(baseUrl: string): Promise<HealthResult> {
  const base = normalizeUrl(baseUrl);
  if (!base)
    return {
      ok: false,
      reason: "invalid-url",
      message: "URL inválida. Use, por exemplo, http://127.0.0.1:17861.",
    };
  const start = performance.now();
  let res: Response;
  try {
    res = await timedFetch(`${base}/health`, { method: "GET" }, 5000);
  } catch (e) {
    return { ok: false, ...fetchFailure(e, 5000) };
  }
  if (!res.ok)
    return { ok: false, reason: "http", message: `/health respondeu HTTP ${res.status}.` };
  try {
    const body = (await res.json()) as Partial<HealthInfo> & { capabilities?: unknown };
    const all = Array.isArray(body.capabilities) ? body.capabilities.map(String) : [];
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      info: {
        status: String(body.status ?? "desconhecido"),
        version: typeof body.version === "string" ? body.version : undefined,
        agent: typeof body.agent === "string" ? body.agent : undefined,
        capabilities: all.filter((c): c is Capability => c in AGENT_ROUTES),
        unknownCapabilities: all.filter((c) => !(c in AGENT_ROUTES)),
      },
    };
  } catch {
    return { ok: false, reason: "bad-response", message: "Resposta de /health não é JSON válido." };
  }
}

/** POST /olt/connection-test (autenticado): valida token e handshake do agente com a OLT. */
export async function testOltConnection(
  baseUrl: string,
  token: string,
): Promise<ConnectionTestResult> {
  const base = normalizeUrl(baseUrl);
  if (!base) return { ok: false, reason: "invalid-url", message: "URL inválida." };
  if (!token.trim())
    return { ok: false, reason: "no-token", message: "Informe o token Bearer do agente." };
  const start = performance.now();
  let res: Response;
  try {
    res = await timedFetch(
      `${base}/olt/connection-test`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      15000,
    );
  } catch (e) {
    return { ok: false, ...fetchFailure(e, 15000) };
  }
  if (res.status === 401 || res.status === 403)
    return {
      ok: false,
      reason: "unauthorized",
      message: "Token inválido: o agente recusou o acesso.",
    };
  if (!res.ok)
    return { ok: false, reason: "http", message: `Teste de conexão respondeu HTTP ${res.status}.` };
  try {
    const body = (await res.json()) as Record<string, unknown>;
    return { ok: true, body, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, reason: "bad-response", message: "Resposta do teste não é JSON válido." };
  }
}

export class AgentUnavailableError extends Error {}
export class AgentAuthError extends Error {}

async function call(
  base: string,
  token: string,
  caps: Capability[],
  cap: Capability,
  path: string,
  init: RequestInit = {},
): Promise<CollectResult> {
  if (!caps.includes(cap))
    throw new AgentUnavailableError(
      "Consulta desabilitada: o agente não anunciou esta capability (pendente de validação).",
    );
  if (!token.trim()) throw new AgentAuthError("Informe o token Bearer para consultar.");
  let res: Response;
  try {
    res = await timedFetch(
      `${base}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      },
      30000,
    );
  } catch (e) {
    throw new Error(fetchFailure(e, 30000).message);
  }
  if (res.status === 401 || res.status === 403)
    throw new AgentAuthError("Token inválido: o agente recusou a consulta.");
  if (!res.ok) throw new Error(`A consulta falhou: o agente respondeu HTTP ${res.status}.`);
  let body: Partial<CollectResult>;
  try {
    body = (await res.json()) as Partial<CollectResult>;
  } catch {
    throw new Error("Resposta da consulta não é JSON válido.");
  }
  if (typeof body.raw !== "string") throw new Error("Resposta da consulta sem saída bruta (raw).");
  return {
    command: String(body.command ?? ""),
    collectedAt: String(body.collectedAt ?? new Date().toISOString()),
    raw: body.raw,
    parsed: body.parsed,
  };
}

function assertPon(pon: string) {
  if (!/^1\/1\/(?:[1-9]|1[0-6])$/.test(pon))
    throw new AgentUnavailableError(`Identificador de PON inválido ou fora do chassi: ${pon}.`);
}

export function createAgentClient(baseUrl: string, token: string, caps: Capability[]) {
  const base = normalizeUrl(baseUrl) ?? "";
  return {
    gponInterface: async (pon: string) => {
      assertPon(pon);
      return call(
        base,
        token,
        caps,
        "gpon.interface.read",
        `/olt/gpon/interface?pon=${encodeURIComponent(pon)}`,
      );
    },
    gponOnus: async (pon: string) => {
      assertPon(pon);
      return call(
        base,
        token,
        caps,
        "gpon.onu.read",
        `/olt/gpon/onu?pon=${encodeURIComponent(pon)}`,
      );
    },
    cliRead: async (command: string) => {
      if (!/^show interface gpon 1\/1\/(?:[1-9]|1[0-6])(?: onu)?$/.test(command))
        throw new Error("Comando fora da allowlist somente leitura GPON.");
      return call(base, token, caps, "cli.read", "/olt/cli/read", {
        method: "POST",
        body: JSON.stringify({ command }),
      });
    },
    /** Escrita/provisionamento/reboot: bloqueado nesta versão. */
    write: (_op: string): Promise<never> =>
      Promise.reject(new Error("Operações de escrita estão bloqueadas nesta versão.")),
  };
}
