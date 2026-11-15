// Cliente tipado do agente local Windows. O token é passado por chamada e
// nunca é gravado (localStorage, URL, logs, console). Apenas a URL pode ser salva.
export const DEFAULT_AGENT_URL = "http://127.0.0.1:17861";
export const AGENT_URL_STORAGE_KEY = "dm4615.agentUrl";

/** PON padrão selecionada na UI (a de laboratório). */
export const VALIDATED_PON = "1/1/2";
/** As 16 PONs da DM4615 (1/1/1 a 1/1/16), todas consultáveis em modo leitura. */
export const PON_LIST = Array.from({ length: 16 }, (_, i) => `1/1/${i + 1}`);
/** @deprecated use PON_LIST */
export const PON_INVENTORY = PON_LIST;
export function isValidPon(pon: string): boolean {
  return PON_LIST.includes(pon);
}

export type Capability = "gpon.interface.read" | "gpon.onu.read" | "cli.read";

/** Rotas documentadas. Só são chamadas se /health declarar a capability. */
export const AGENT_ROUTES: Record<
  Capability,
  { method: "GET" | "POST"; path: string; description: string }
> = {
  "gpon.interface.read": {
    method: "GET",
    path: "/olt/gpon/interface?pon=1/1/N",
    description: "show interface gpon 1/1/N",
  },
  "gpon.onu.read": {
    method: "GET",
    path: "/olt/gpon/onu?pon=1/1/N",
    description: "show interface gpon 1/1/N onu",
  },
  "cli.read": {
    method: "POST",
    path: "/olt/cli/read",
    description: "Comandos da allowlist somente leitura",
  },
};

/** Comandos permitidos no terminal. Nada de escrita/config/reboot. */
export const READ_ONLY_COMMANDS: readonly string[] = PON_LIST.flatMap((p) => [
  `show interface gpon ${p}`,
  `show interface gpon ${p} onu`,
]);

export interface OnuInfo {
  onuId: number | null;
  serial: string;
  state: string;
}

/**
 * Extrai ONUs do campo `parsed` do agente de forma tolerante. Aceita lista
 * direta ou objeto com `onus`/`items`. Campos: id|onuId|onu_id, serial|serialNumber|sn,
 * state|status|operState. Formato desconhecido retorna null (nunca dados fictícios).
 */
export function parseOnus(parsed: unknown): OnuInfo[] | null {
  const rec = parsed as Record<string, unknown> | null;
  const list = Array.isArray(parsed)
    ? parsed
    : rec && typeof rec === "object"
      ? (rec.onus ?? rec.items ?? rec.onuList)
      : null;
  if (!Array.isArray(list)) return null;
  const out: OnuInfo[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const serial = o.serial ?? o.serialNumber ?? o.serial_number ?? o.sn;
    if (typeof serial !== "string" || !serial.trim()) continue;
    const idRaw = o.onuId ?? o.onu_id ?? o.id ?? o.onu;
    const id = idRaw === undefined || idRaw === null ? NaN : Number(idRaw);
    const state = o.state ?? o.status ?? o.operState ?? o.oper_state ?? o.operStatus;
    out.push({
      onuId: Number.isFinite(id) ? id : null,
      serial: serial.trim(),
      state: typeof state === "string" && state.trim() ? state.trim() : "Desconhecido",
    });
  }
  return out;
}

/** Fallback: interpreta a saída bruta "1/1/N  id  SERIAL  Up|Down". */
export function parseOnusRaw(raw: string, pon: string): OnuInfo[] {
  const esc = pon.replace(/\//g, "\\/");
  const re = new RegExp(`^\\s*${esc}\\s+(\\d+)\\s+([A-Z0-9]{8,})\\s+(Up|Down)\\b`, "gim");
  return [...raw.matchAll(re)].map((m) => ({ onuId: Number(m[1]), serial: m[2]!, state: m[3]! }));
}

export function onusFrom(r: CollectResult, pon: string): OnuInfo[] | null {
  return parseOnus(r.parsed) ?? (parseOnusRaw(r.raw, pon).length ? parseOnusRaw(r.raw, pon) : null);
}

/** Executa tarefas com concorrência limitada (para varrer as 16 PONs). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]!);
      }
    }),
  );
  return out;
}

async function problemDetail(res: Response): Promise<string | null> {
  try {
    const b = (await res.json()) as Record<string, unknown>;
    const d = b.detail ?? b.error ?? b.title;
    return typeof d === "string" && d.trim() ? d.trim() : null;
  } catch {
    return null;
  }
}

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
  if (!res.ok) {
    const d = await problemDetail(res);
    return {
      ok: false,
      reason: "http",
      message: `Teste de conexão respondeu HTTP ${res.status}${d ? `: ${d}` : "."}`,
    };
  }
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
  if (!res.ok) {
    const d = await problemDetail(res);
    throw new Error(
      `A consulta falhou: o agente respondeu HTTP ${res.status}${d ? ` — ${d}` : "."}`,
    );
  }
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
  if (!isValidPon(pon))
    throw new AgentUnavailableError(
      `PON ${pon} fora do intervalo 1/1/1–1/1/16: consulta bloqueada.`,
    );
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
      if (!READ_ONLY_COMMANDS.includes(command))
        throw new Error("Comando fora da allowlist somente leitura.");
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
