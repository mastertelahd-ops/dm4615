// Cliente tipado do agente local Windows. O token é passado por chamada e
// nunca é gravado (localStorage, URL, logs). Apenas a URL pode ser salva.
export const DEFAULT_AGENT_URL = "http://127.0.0.1:17861";
export const AGENT_URL_STORAGE_KEY = "dm4615.agentUrl";

export type Capability = "gpon.interface.read" | "gpon.onu.read" | "cli.read";

/** Rotas que o agente precisa implementar. Só são chamadas se /health declarar a capability. */
export const AGENT_ROUTES: Record<
  Capability,
  { method: "GET" | "POST"; path: string; description: string }
> = {
  "gpon.interface.read": {
    method: "GET",
    path: "/olt/gpon/interface?pon={pon}",
    description: "Executa `show interface gpon {pon}`",
  },
  "gpon.onu.read": {
    method: "GET",
    path: "/olt/gpon/onu?pon={pon}",
    description: "Executa `show interface gpon {pon} onu`",
  },
  "cli.read": {
    method: "POST",
    path: "/olt/cli/read",
    description: "Executa comando da allowlist somente leitura",
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
}
export interface CollectResult {
  command: string;
  collectedAt: string;
  raw: string;
  parsed?: unknown;
}

export type HealthResult =
  | { ok: true; info: HealthInfo; latencyMs: number }
  | {
      ok: false;
      reason: "invalid-url" | "timeout" | "network" | "unauthorized" | "http" | "bad-response";
      message: string;
    };

export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function headers(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function timedFetch(url: string, init: RequestInit, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function checkHealth(baseUrl: string, token: string): Promise<HealthResult> {
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
    res = await timedFetch(`${base}/health`, {
      method: "GET",
      headers: headers(token),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      return { ok: false, reason: "timeout", message: "O agente não respondeu em 5 segundos." };
    return {
      ok: false,
      reason: "network",
      message:
        "Agente inacessível: verifique se o serviço está rodando nesta máquina e se libera CORS (e Access-Control-Allow-Private-Network) para esta origem.",
    };
  }
  if (res.status === 401 || res.status === 403)
    return { ok: false, reason: "unauthorized", message: "O agente recusou o token informado." };
  if (!res.ok)
    return { ok: false, reason: "http", message: `O agente respondeu HTTP ${res.status}.` };
  try {
    const body = (await res.json()) as Partial<HealthInfo>;
    const caps = Array.isArray(body.capabilities)
      ? body.capabilities.filter((c): c is Capability => c in AGENT_ROUTES)
      : [];
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      info: {
        status: String(body.status ?? "ok"),
        version: body.version,
        agent: body.agent,
        capabilities: caps,
      },
    };
  } catch {
    return { ok: false, reason: "bad-response", message: "Resposta de /health não é JSON válido." };
  }
}

export interface SshConnectionResult {
  connected: boolean;
  host: string;
  port: number;
  hostKeyVerified: boolean;
  commandExecuted: false;
  message: string;
}

/** Valida o handshake SSH sem executar comandos na OLT. */
export async function testSshConnection(baseUrl: string, token: string): Promise<SshConnectionResult> {
  const base = normalizeUrl(baseUrl);
  if (!base) throw new Error("URL inválida do agente.");
  let res: Response;
  try {
    res = await timedFetch(
      `${base}/olt/connection-test`,
      { method: "POST", headers: headers(token), cache: "no-store" },
      15000,
    );
  } catch {
    throw new Error("Não foi possível alcançar o teste SSH do agente.");
  }
  if (res.status === 401 || res.status === 403)
    throw new Error("Token do agente recusado. Confira o mesmo token nas duas janelas.");
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch {
      /* ignore invalid error body */
    }
    throw new Error(detail || `Falha no handshake SSH (HTTP ${res.status}).`);
  }
  return (await res.json()) as SshConnectionResult;
}

export class AgentUnavailableError extends Error {}

async function call(
  base: string,
  token: string,
  caps: Capability[],
  cap: Capability,
  path: string,
  init: RequestInit = {},
): Promise<CollectResult> {
  if (!caps.includes(cap))
    throw new AgentUnavailableError("Aguardando agente: consulta não implementada.");
  const res = await timedFetch(
    `${base}${path}`,
    {
      ...init,
      headers: { ...headers(token), ...(init.body ? { "Content-Type": "application/json" } : {}) },
    },
    30000,
  );
  if (!res.ok) throw new Error(`O agente respondeu HTTP ${res.status}.`);
  return (await res.json()) as CollectResult;
}

export function createAgentClient(baseUrl: string, token: string, caps: Capability[]) {
  const base = normalizeUrl(baseUrl) ?? "";
  return {
    gponInterface: (pon: string) =>
      call(
        base,
        token,
        caps,
        "gpon.interface.read",
        `/olt/gpon/interface?pon=${encodeURIComponent(pon)}`,
      ),
    gponOnus: (pon: string) =>
      call(base, token, caps, "gpon.onu.read", `/olt/gpon/onu?pon=${encodeURIComponent(pon)}`),
    cliRead: (command: string) => {
      if (!(READ_ONLY_COMMANDS as readonly string[]).includes(command))
        return Promise.reject(new Error("Comando fora da allowlist somente leitura."));
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
