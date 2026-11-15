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
  testSshConnection,
  createAgentClient,
  type HealthResult,
  type SshConnectionResult,
} from "./agent-api";

interface Ctx {
  url: string;
  setUrl: (u: string) => void;
  saveUrl: () => void;
  token: string;
  setToken: (t: string) => void; // somente memória
  health: HealthResult | null;
  sshResult: { ok: true; data: SshConnectionResult } | { ok: false; message: string } | null;
  checking: boolean;
  lastCheck: Date | null;
  test: () => Promise<void>;
  client: ReturnType<typeof createAgentClient>;
  online: boolean;
}
const AgentCtx = createContext<Ctx | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState(DEFAULT_AGENT_URL);
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [sshResult, setSshResult] = useState<Ctx["sshResult"]>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
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
      const result = await checkHealth(url, token);
      setHealth(result);
      if (!result.ok) {
        setSshResult(null);
      } else {
        try {
          setSshResult({ ok: true, data: await testSshConnection(url, token) });
        } catch (e) {
          setSshResult({
            ok: false,
            message: e instanceof Error ? e.message : "Falha no teste SSH.",
          });
        }
      }
    } finally {
      setChecking(false);
      setLastCheck(new Date());
    }
  }, [url, token]);
  const online = health?.ok === true;
  const caps = health?.ok ? health.info.capabilities : [];
  const client = useMemo(() => createAgentClient(url, token, caps), [url, token, caps.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AgentCtx.Provider
      value={{
        url,
        setUrl,
        saveUrl,
        token,
        setToken,
        health,
        sshResult,
        checking,
        lastCheck,
        test,
        client,
        online,
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
