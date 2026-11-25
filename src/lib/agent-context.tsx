import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AGENT_URL_STORAGE_KEY,
  DEFAULT_AGENT_URL,
  checkHealth,
  createAgentClient,
  testOltConnection,
  type ConnectionTestResult,
  type HealthResult,
} from "./agent-api";

export interface AgentEvent {
  at: Date;
  kind: "info" | "ok" | "erro";
  action: string;
  detail: string;
}

interface Ctx {
  url: string;
  setUrl: (u: string) => void;
  saveUrl: () => void;
  token: string;
  setToken: (t: string) => void; // somente memória
  health: HealthResult | null;
  connTest: ConnectionTestResult | null;
  checking: boolean;
  lastCheck: Date | null;
  test: () => Promise<void>;
  client: ReturnType<typeof createAgentClient>;
  online: boolean;
  demo: boolean;
  setDemo: (d: boolean) => void;
  events: AgentEvent[];
  log: (kind: AgentEvent["kind"], action: string, detail: string) => void;
}
const AgentCtx = createContext<Ctx | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState(DEFAULT_AGENT_URL);
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [connTest, setConnTest] = useState<ConnectionTestResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [demo, setDemo] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const log = useCallback(
    (kind: AgentEvent["kind"], action: string, detail: string) =>
      setEvents((e) => [{ at: new Date(), kind, action, detail }, ...e].slice(0, 200)),
    [],
  );
  useEffect(() => {
    try {
      const s = localStorage.getItem(AGENT_URL_STORAGE_KEY);
      if (s) setUrl(s);
    } catch {
      /* ignore */
    }
  }, []);
  const saveUrl = useCallback(() => {
    try {
      localStorage.setItem(AGENT_URL_STORAGE_KEY, url);
    } catch {
      /* ignore */
    }
  }, [url]);
  const test = useCallback(async () => {
    setChecking(true);
    try {
      const h = await checkHealth(url);
      setHealth(h);
      log(h.ok ? "ok" : "erro", "GET /health", h.ok ? `online (${h.latencyMs} ms)` : h.message);
      if (h.ok) {
        const c = await testOltConnection(url, token);
        setConnTest(c);
        log(c.ok ? "ok" : "erro", "POST /olt/connection-test", c.ok ? "aceito" : c.message);
      } else setConnTest(null);
    } finally {
      setChecking(false);
      setLastCheck(new Date());
    }
  }, [url, token, log]);
  const online = health?.ok === true;
  const caps = health?.ok ? health.info.capabilities : [];
  const capsKey = caps.join(",");
  const client = useMemo(
    () => createAgentClient(url, token, capsKey ? (capsKey.split(",") as typeof caps) : []),
    [url, token, capsKey],
  );
  return (
    <AgentCtx.Provider
      value={{
        url,
        setUrl,
        saveUrl,
        token,
        setToken,
        health,
        connTest,
        checking,
        lastCheck,
        test,
        client,
        online,
        demo,
        setDemo,
        events,
        log,
      }}
    >
      {children}
    </AgentCtx.Provider>
  );
}
export function useAgent() {
  const c = useContext(AgentCtx);
  if (!c) throw new Error("AgentProvider ausente");
  return c;
}
