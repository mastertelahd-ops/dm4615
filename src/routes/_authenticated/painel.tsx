import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Cable,
  FlaskConical,
  LayoutDashboard,
  Lock,
  Menu,
  Network,
  PlugZap,
  RefreshCw,
  TerminalSquare,
  X,
} from "lucide-react";
import { useAgent } from "@/lib/agent-context";
import {
  AGENT_ROUTES,
  AgentUnavailableError,
  PON_LIST,
  READ_ONLY_COMMANDS,
  mapLimit,
  onusFrom,
  parseInterface,
  type OnuInfo,
  VALIDATED_PON,
  isLoopback,
  type Capability,
  type CollectResult,
  type GponInterfaceParsed,
} from "@/lib/agent-api";
import { DEMO_DATA as D, DEMO_LABEL } from "@/lib/demo-data";
import { MANUAL_HISTORY_DATE, MANUAL_PON_HISTORY } from "@/lib/manual-history";

const DESC = "Painel NOC somente leitura para OLT Datacom DM4615 via agente local Windows.";
export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "DM4615 | Painel NOC da OLT" },
      { name: "description", content: DESC },
      { property: "og:title", content: "DM4615 | Painel NOC da OLT" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const nav = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "GPON/ONUs", icon: Cable },
  { label: "Conexão do agente", icon: PlugZap },
  { label: "Eventos/diagnóstico", icon: Activity },
] as const;
type Section = (typeof nav)[number]["label"];

function Index() {
  const [active, setActive] = useState<Section>("Visão geral");
  const [mobileNav, setMobileNav] = useState(false);
  const { online, health, demo, setDemo } = useAgent();
  const scan = usePonScan();
  const agentLabel = online ? "ONLINE" : health ? "OFFLINE" : "DESCONHECIDO";

  return (
    <div className="min-h-screen bg-[#080d17] text-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[0.07] bg-[#0c1320] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <Network size={22} />
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-wide">
              DM<span className="text-cyan-300">4615</span>
            </div>
            <div className="text-[10px] uppercase tracking-[.2em] text-slate-500">
              NOC • leitura
            </div>
          </div>
          <button
            className="ml-auto text-slate-500 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1 px-4 pt-6" aria-label="Seções">
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              aria-current={active === label ? "page" : undefined}
              onClick={() => {
                setActive(label);
                setMobileNav(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${active === label ? "bg-cyan-400/10 font-semibold text-cyan-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.05] p-3 text-xs text-fuchsia-200">
            <span className="flex items-center gap-2">
              <FlaskConical size={15} /> Modo demonstração
            </span>
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              className="h-4 w-4 accent-fuchsia-400"
            />
          </label>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Lock size={15} className="text-emerald-400" /> Somente leitura
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Provisionamento, VLAN, remoção e reboot não existem nesta versão.
            </p>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between gap-3 border-b border-white/[0.07] bg-[#080d17]/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="text-slate-400 lg:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{active}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                Datacom DM4615 • 192.168.0.25
              </div>
            </div>
          </div>
          <a
            href="/cadastros"
            className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20"
          >
            Cadastros
          </a>
          <a
            href="/autoprovisionamento"
            className="shrink-0 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20"
          >
            Autoprovisionamento
          </a>
          {demo ? (
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-bold text-fuchsia-200">
              SIMULAÇÃO
            </span>
          ) : (
            <button
              onClick={() => setActive("Conexão do agente")}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium ${online ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300" : health ? "border-red-400/20 bg-red-400/[0.07] text-red-300" : "border-slate-500/30 bg-white/[0.03] text-slate-400"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : health ? "bg-red-400" : "bg-slate-500"}`}
              />
              AGENTE {agentLabel}
            </button>
          )}
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          {demo ? (
            <DemoView section={active} />
          ) : (
            <>
              {active === "Visão geral" && <Overview go={setActive} scan={scan} />}
              {active === "GPON/ONUs" && <Gpon scan={scan} />}
              {active === "Conexão do agente" && <Connection />}
              {active === "Eventos/diagnóstico" && <Events />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- primitivas ---------- */
function Title({
  kicker,
  title,
  desc,
  children,
}: {
  kicker: string;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-cyan-300">
          <span className="h-px w-5 bg-cyan-300" /> {kicker}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
      </div>
      {children}
    </section>
  );
}
function Card({
  title,
  desc,
  children,
  right,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-[#0c1320] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {desc && <p className="mt-1 text-[11px] text-slate-500">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Notice({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "slate" | "red";
}) {
  const c = {
    amber: "border-amber-400/20 bg-amber-400/[0.055] text-amber-100/80",
    slate: "border-white/10 bg-white/[0.03] text-slate-400",
    red: "border-red-400/20 bg-red-400/[0.06] text-red-200",
  }[tone];
  return (
    <div
      role={tone === "red" ? "alert" : undefined}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[11px] leading-relaxed ${c}`}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const good = value === "Up" || value === "Online";
  const bad = value === "Down" || value === "Offline";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${good ? "bg-emerald-400/10 text-emerald-300" : bad ? "bg-red-400/10 text-red-300" : "bg-slate-500/10 text-slate-400"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${good ? "bg-emerald-400" : bad ? "bg-red-400" : "bg-slate-500"}`}
      />
      {value}
    </span>
  );
}
function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-slate-500">{k}</div>
      <div className="mt-1 break-words text-xs font-semibold text-slate-300">{v}</div>
    </div>
  );
}
function Btn({
  onClick,
  disabled,
  children,
  icon: Icon = RefreshCw,
  ghost,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  icon?: typeof RefreshCw;
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${ghost ? "border border-white/10 text-slate-300 hover:bg-white/5" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"}`}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

/* ---------- coleta real ---------- */
function useCollect(cap: Capability, fn: () => Promise<CollectResult>, label: string) {
  const { online, health, log } = useAgent();
  const [state, setState] = useState<{ loading: boolean; result?: CollectResult; error?: string }>({
    loading: false,
  });
  const available = online && health?.ok === true && health.info.capabilities.includes(cap);
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await fn();
      setState({ loading: false, result: r });
      log("ok", label, `coletado ${new Date(r.collectedAt).toLocaleTimeString("pt-BR")}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Falha na consulta.";
      setState({ loading: false, error: m });
      log(e instanceof AgentUnavailableError ? "info" : "erro", label, m);
    }
  }, [fn, label, log]);
  return { ...state, available, run, online };
}

function CollectView({ c, cap }: { c: ReturnType<typeof useCollect>; cap: Capability }) {
  if (!c.online)
    return (
      <Notice tone="slate">
        Agente desconectado: teste a conexão para habilitar coletas ao vivo.
      </Notice>
    );
  if (!c.available)
    return (
      <Notice tone="slate">
        Consulta desabilitada / pendente de validação: o agente não anunciou{" "}
        <span className="font-mono">{cap}</span> em /health (
        <span className="font-mono">
          {AGENT_ROUTES[cap].method} {AGENT_ROUTES[cap].path}
        </span>
        ). Um handshake SSH bem-sucedido não habilita consultas CLI.
      </Notice>
    );
  return (
    <div className="space-y-3">
      {c.error && <Notice tone="red">{c.error}</Notice>}
      {!c.result && !c.error && (
        <p className="text-xs text-slate-500">Nenhuma coleta ainda. Clique em consultar.</p>
      )}
      {c.result && (
        <div>
          <div className="mb-2 text-[11px] text-slate-500">
            Coletado ao vivo em {new Date(c.result.collectedAt).toLocaleString("pt-BR")} •{" "}
            <span className="font-mono">{c.result.command}</span>
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg bg-[#05080f] p-4 font-mono text-[11px] text-slate-300">
            {c.result.raw}
          </pre>
          {c.result.parsed !== undefined && (
            <details className="mt-2 text-[11px] text-slate-400">
              <summary className="cursor-pointer">Dados interpretados pelo agente</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#05080f] p-3 font-mono">
                {JSON.stringify(c.result.parsed, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- seções ---------- */
type PonScan = {
  pon: string;
  status: "pendente" | "ok" | "erro";
  iface: GponInterfaceParsed | null;
  onus: OnuInfo[] | null;
  error?: string;
  collectedAt?: string;
};

/** Varredura explícita: somente após clique, no máximo 4 PONs simultâneas. */
function usePonScan() {
  const { client, online, health, log } = useAgent();
  const available =
    online &&
    health?.ok === true &&
    health.info.capabilities.includes("gpon.interface.read") &&
    health.info.capabilities.includes("gpon.onu.read");
  const [scans, setScans] = useState<PonScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!available || loading) return;
    setLoading(true);
    setScans(PON_LIST.map((pon) => ({ pon, status: "pendente", iface: null, onus: null })));
    try {
      const results = await mapLimit(PON_LIST, 4, async (pon): Promise<PonScan> => {
        let iface: GponInterfaceParsed | null = null;
        try {
          const interfaceResult = await client.gponInterface(pon);
          iface = parseInterface(interfaceResult.parsed);
          if (!iface) throw new Error(`A resposta da interface ${pon} não contém dados estruturados válidos.`);

          const onuResult = await client.gponOnus(pon);
          const onus = onusFrom(onuResult, pon);
          if (onus === null) throw new Error(`A resposta da lista de ONUs da ${pon} não pôde ser interpretada.`);

          return { pon, status: "ok", iface, onus, collectedAt: onuResult.collectedAt };
        } catch (error) {
          return {
            pon,
            status: "erro",
            iface,
            onus: null,
            error: error instanceof Error ? error.message : "Falha na consulta.",
          };
        }
      });
      setScans(results);
      setAt(new Date());
      const total = results.reduce((n, item) => n + (item.onus?.length ?? 0), 0);
      const failures = results.filter((item) => item.status === "erro").length;
      log(failures ? "erro" : "ok", "Varredura manual das 16 PONs", `${total} ONU(s); ${failures} PON(s) com falha`);
    } finally {
      setLoading(false);
    }
  }, [available, client, log, loading]);

  // Quando o agente cai, não apresentar a última leitura como se fosse atual.
  const visibleScans = online ? scans : [];
  return {
    scans: visibleScans,
    loading,
    at: online ? at : null,
    available,
    refresh,
    online,
    historical: !online,
  };
}

function Overview({ go, scan }: { go: (s: Section) => void; scan: ReturnType<typeof usePonScan> }) {
  const { online, health, lastCheck } = useAgent();
  const all = scan.scans.flatMap((item) => item.onus ?? []);
  const up = all.filter((onu) => /^up$|online/i.test(onu.state)).length;
  const portsWithOnus = scan.scans.filter((item) => (item.onus?.length ?? 0) > 0).length;
  const historicalPorts = Object.values(MANUAL_PON_HISTORY).filter((item) => item.onuCount > 0).length;
  const historicalOnus = Object.values(MANUAL_PON_HISTORY).reduce((sum, item) => sum + item.onuCount, 0);
  const hasLiveScan = scan.scans.length > 0;

  return (
    <>
      <Title
        kicker="Network operations center"
        title="Visão geral"
        desc="Dados ao vivo somente após consulta manual ao agente. O histórico fica identificado separadamente."
      />
      {!online && (
        <Notice>
          Agente desconectado. O histórico abaixo é apenas referência da coleta manual de {MANUAL_HISTORY_DATE}; não confirma o estado atual da OLT.{" "}
          <button className="font-semibold text-cyan-300" onClick={() => go("Conexão do agente")}>
            Conectar agente →
          </button>
        </Notice>
      )}
      {online && !scan.available && (
        <Notice tone="slate">
          O agente está online, mas precisa anunciar as capabilities{" "}
          <span className="font-mono">gpon.interface.read</span> e{" "}
          <span className="font-mono">gpon.onu.read</span> para consultar as 16 PONs.
        </Notice>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Agente local">
          <KV
            k={lastCheck ? `Teste às ${lastCheck.toLocaleTimeString("pt-BR")}` : "Nunca testado"}
            v={<Status value={online ? "Online" : health ? "Offline" : "Desconhecido"} />}
          />
        </Card>
        <Card title="OLT">
          <KV k="Datacom DM4615" v="192.168.0.25 • SSH 22" />
        </Card>
        <Card title="PONs com ONU">
          <KV
            k={scan.historical ? `Histórico manual • ${MANUAL_HISTORY_DATE}` : "Última consulta ao agente"}
            v={hasLiveScan ? `${portsWithOnus} de 16` : scan.historical ? `${historicalPorts} de 16` : "—"}
          />
        </Card>
        <Card title="ONUs">
          <KV
            k={scan.historical ? "Contagem histórica; sem status individual" : "Up / total na última consulta"}
            v={hasLiveScan ? `${up} / ${all.length}` : scan.historical ? String(historicalOnus) : "—"}
          />
        </Card>
      </section>
      <PonGrid scan={scan} />
      <OnuTable scan={scan} />
    </>
  );
}

function PonGrid({ scan }: { scan: ReturnType<typeof usePonScan> }) {
  const byPon = new Map(scan.scans.map((item) => [item.pon, item]));
  return (
    <Card
      title="PONs 1/1/1 – 1/1/16"
      desc={scan.historical
        ? `ÚLTIMA COLETA MANUAL — ${MANUAL_HISTORY_DATE} — NÃO É ESTADO AO VIVO.`
        : "Estado administrativo, estado operacional e quantidade de ONUs consultados no agente."}
      right={
        <Btn disabled={!scan.available || scan.loading} onClick={scan.refresh}>
          {scan.loading ? "Consultando..." : "Consultar 16 PONs"}
        </Btn>
      }
    >
      {scan.historical && (
        <Notice tone="amber">
          <b>ÚLTIMA COLETA MANUAL — NÃO É ESTADO AO VIVO.</b> Os dados abaixo não confirmam a condição atual da OLT.
        </Notice>
      )}
      {!scan.historical && !scan.scans.length && (
        <p className="mb-3 text-[11px] text-slate-500">Nenhuma varredura executada. Clique em “Consultar 16 PONs” para iniciar uma leitura.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {PON_LIST.map((pon) => {
          const item = byPon.get(pon);
          const history = MANUAL_PON_HISTORY[pon];
          const isHistory = scan.historical && !item;
          const admin = item?.iface?.adminState ?? (isHistory ? "Enabled" : "—");
          const oper = item?.iface?.operState ?? (isHistory ? history?.operState ?? "—" : "—");
          const count = item?.iface?.onuCount ?? item?.onus?.length ?? (isHistory ? history?.onuCount : null);
          const label = item?.status === "pendente"
            ? "consultando"
            : item?.status === "erro"
              ? "falha na consulta"
              : item?.status === "ok"
                ? "leitura atual"
                : isHistory
                  ? "histórico manual"
                  : "sem leitura";
          return (
            <div
              key={pon}
              data-testid={`pon-${pon}`}
              title={item?.error}
              className={`rounded-lg border p-3 ${item?.status === "erro" ? "border-rose-400/30" : count ? "border-cyan-400/30 bg-cyan-400/[0.05]" : "border-white/[0.07]"}`}
            >
              <div className="font-mono text-xs font-semibold">{pon}</div>
              <div className="mt-2 space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center justify-between gap-1"><span>Admin</span><Status value={admin} /></div>
                <div className="flex items-center justify-between gap-1"><span>Link</span><Status value={oper} /></div>
                <div>ONUs: {count === null || count === undefined ? "—" : count}</div>
                <div className="text-[9px]">{label}</div>
              </div>
              {item?.error && <p className="mt-2 break-words text-[9px] text-rose-300">{item.error}</p>}
            </div>
          );
        })}
      </div>
      {scan.at && scan.online && (
        <p className="mt-3 text-[10px] text-slate-500">Varredura concluída em {scan.at.toLocaleString("pt-BR")}. Sem atualização automática.</p>
      )}
    </Card>
  );
}

function OnuTable({ scan }: { scan: ReturnType<typeof usePonScan> }) {
  const rows = scan.scans.flatMap((item) => (item.onus ?? []).map((onu) => ({ ...onu, pon: item.pon })));
  const failures = scan.scans.filter((item) => item.status === "erro");
  return (
    <Card
      title="ONUs detectadas (todas as PONs)"
      desc="Seriais e estados exibidos somente quando retornados pela consulta atual do agente."
      right={
        <div className="text-[10px] text-slate-500">
          {scan.at ? `Última varredura: ${scan.at.toLocaleTimeString("pt-BR")}` : "Aguardando consulta"}
        </div>
      }
    >
      {scan.historical && (
        <p role="status" className="mb-3 text-[11px] text-amber-200">
          O histórico manual contém somente contagens por PON; não há seriais históricos disponíveis para exibição.
        </p>
      )}
      {failures.length > 0 && (
        <p role="status" className="mb-3 text-[11px] text-rose-300">
          Falha em {failures.map((item) => item.pon).join(", ")}. Consulte o detalhe em cada porta.
        </p>
      )}
      {scan.online && scan.scans.length > 0 && rows.length === 0 && failures.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma ONU encontrada nas PONs consultadas. Isso não é erro.</p>
      )}
      {scan.online && scan.scans.length === 0 && (
        <p className="text-xs text-slate-500">Clique em “Consultar 16 PONs” para listar os seriais reais.</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-medium">PON</th>
                <th className="py-2 font-medium">ONU ID</th>
                <th className="py-2 font-medium">Serial</th>
                <th className="py-2 font-medium">Estado OLT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((onu) => (
                <tr key={`${onu.pon}-${onu.serial}`} className="border-t border-white/[0.045] text-xs">
                  <td className="py-3 font-mono">{onu.pon}</td>
                  <td className="py-3 font-mono">{onu.onuId ?? "—"}</td>
                  <td className="py-3 font-mono text-slate-300">{onu.serial}</td>
                  <td className="py-3"><Status value={onu.state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Gpon({ scan }: { scan: ReturnType<typeof usePonScan> }) {
  const { client } = useAgent();
  const [pon, setPon] = useState<string>(VALIDATED_PON);
  const [cmd, setCmd] = useState<string>(READ_ONLY_COMMANDS[0]!);
  const iface = useCollect(
    "gpon.interface.read",
    useCallback(() => client.gponInterface(pon), [client, pon]),
    `Interface ${pon}`,
  );
  const onus = useCollect(
    "gpon.onu.read",
    useCallback(() => client.gponOnus(pon), [client, pon]),
    `ONUs ${pon}`,
  );
  const cli = useCollect(
    "cli.read",
    useCallback(() => client.cliRead(cmd), [client, cmd]),
    `CLI: ${cmd}`,
  );
  const anyAvail = iface.available || onus.available;
  const refreshAll = useCallback(async () => {
    await Promise.all([iface.available ? iface.run() : null, onus.available ? onus.run() : null]);
  }, [iface, onus]);
  return (
    <>
      <Title kicker="GPON" title="GPON/ONUs" desc="Consulta detalhada por PON (1/1/1 a 1/1/16).">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="PON"
            value={pon}
            onChange={(e) => setPon(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#080d17] px-3 py-2 font-mono text-xs text-slate-200"
          >
            {PON_LIST.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Btn disabled={!anyAvail || iface.loading || onus.loading} onClick={refreshAll}>
            Atualizar agora
          </Btn>
        </div>
      </Title>
      <PonGrid scan={scan} />
      <section className="grid gap-5 xl:grid-cols-2">
        <Card
          title={`Interface ${pon} (ao vivo)`}
          right={
            <Btn disabled={!iface.available || iface.loading} onClick={iface.run}>
              {iface.loading ? "Consultando..." : "Consultar"}
            </Btn>
          }
        >
          <CollectView c={iface} cap="gpon.interface.read" />
        </Card>
        <Card
          title={`ONUs ${pon} (ao vivo)`}
          right={
            <Btn disabled={!onus.available || onus.loading} onClick={onus.run}>
              {onus.loading ? "Listando..." : "Listar ONUs"}
            </Btn>
          }
        >
          <CollectView c={onus} cap="gpon.onu.read" />
        </Card>
      </section>
      <OnuTable scan={scan} />
      <Card title="Terminal somente leitura" desc="Somente comandos show da allowlist (16 PONs).">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Comando"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 font-mono text-xs text-slate-200 outline-none"
          >
            {READ_ONLY_COMMANDS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <Btn icon={TerminalSquare} disabled={!cli.available || cli.loading} onClick={cli.run}>
            Executar
          </Btn>
        </div>
        <div className="mt-4">
          <CollectView c={cli} cap="cli.read" />
        </div>
      </Card>
    </>
  );
}

function Connection() {
  const {
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
    log,
  } = useAgent();
  const [saved, setSaved] = useState(false);
  const inputCls =
    "mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400/50";
  return (
    <>
      <Title
        kicker="Agente local Windows"
        title="Conexão do agente"
        desc="O agente roda nesta máquina (loopback) e é quem acessa a OLT via SSH. Credenciais SSH nunca chegam ao navegador."
      />
      {!isLoopback(url) && (
        <Notice tone="red">
          A URL não é loopback (127.0.0.1/localhost). O agente não deve ser exposto na rede ou na
          internet.
        </Notice>
      )}
      <section className="grid gap-5 xl:grid-cols-2">
        <Card title="Configuração">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void test();
            }}
          >
            <label className="block text-xs text-slate-400">
              URL do agente
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSaved(false);
                }}
                className={inputCls}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Token Bearer (somente memória desta aba)
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={inputCls}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                <PlugZap size={15} /> {checking ? "Testando..." : "Testar conexão"}
              </button>
              <Btn
                ghost
                onClick={() => {
                  saveUrl();
                  setSaved(true);
                  log("info", "URL do agente salva", url);
                }}
              >
                Salvar URL
              </Btn>
              {saved && (
                <span className="self-center text-[11px] text-emerald-300">
                  URL salva neste navegador.
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              O token não é salvo: ao recarregar a página, informe-o novamente.
            </p>
          </form>
        </Card>
        <Card
          title="Estado"
          desc={
            lastCheck
              ? `Último teste: ${lastCheck.toLocaleTimeString("pt-BR")}`
              : "Ainda não testado"
          }
        >
          {!health && (
            <Notice tone="slate">
              Clique em “Testar conexão”: GET /health (público) e depois POST /olt/connection-test
              (com token).
            </Notice>
          )}
          {health && !health.ok && (
            <Notice tone="red">
              <b>Agente offline.</b> {health.message}
            </Notice>
          )}
          {health?.ok && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Status value="Online" />{" "}
                <span className="text-[11px] text-slate-500">GET /health</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <KV k="Status" v={health.info.status} />
                <KV k="Versão" v={health.info.version ?? "—"} />
                <KV k="Latência" v={`${health.latencyMs} ms`} />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  Teste autenticado (POST /olt/connection-test)
                </div>
                {connTest?.ok ? (
                  <pre className="max-h-40 overflow-auto rounded-lg bg-[#05080f] p-3 font-mono text-[11px] text-emerald-200">
                    {JSON.stringify(connTest.body, null, 2)}
                  </pre>
                ) : (
                  <Notice tone="red">{connTest?.message ?? "Não executado."}</Notice>
                )}
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  Capabilities anunciadas em /health
                </div>
                <ul className="space-y-1 text-[11px]">
                  {(Object.keys(AGENT_ROUTES) as Capability[]).map((c) => (
                    <li key={c} className="flex justify-between gap-2">
                      <span className="font-mono text-slate-400">{c}</span>
                      {health.info.capabilities.includes(c) ? (
                        <span className="text-emerald-300">anunciada</span>
                      ) : (
                        <span className="text-slate-500">ausente — desabilitada</span>
                      )}
                    </li>
                  ))}
                  {health.info.unknownCapabilities.map((c) => (
                    <li key={c} className="flex justify-between gap-2">
                      <span className="font-mono text-slate-500">{c}</span>
                      <span className="text-slate-500">não usada pelo painel</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

function Events() {
  const { events } = useAgent();
  return (
    <>
      <Title
        kicker="Rastreabilidade"
        title="Eventos/diagnóstico"
        desc="Eventos desta sessão (somente memória, nunca contêm o token)."
      />
      <Notice tone="slate">
        Diagnóstico óptico (potência RX/TX, distância, tráfego) não tem comando validado no DM4615 —
        nenhum valor é exibido.
      </Notice>
      <Card title="Eventos da sessão">
        {events.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum evento registrado.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05] text-xs">
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${e.kind === "ok" ? "bg-emerald-400" : e.kind === "erro" ? "bg-red-400" : "bg-slate-500"}`}
                  />
                  <span className="text-slate-300">{e.action}</span>
                </span>
                <span className="text-slate-500">
                  {e.detail} • {e.at.toLocaleTimeString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/* ---------- modo demonstração (isolado) ---------- */
function DemoView({ section }: { section: Section }) {
  return (
    <>
      <div
        role="status"
        className="rounded-xl border-2 border-dashed border-fuchsia-400/50 bg-fuchsia-400/[0.07] px-4 py-3 text-center text-sm font-bold tracking-wide text-fuchsia-200"
      >
        {DEMO_LABEL}
      </div>
      <Title
        kicker="Demonstração"
        title={section}
        desc="Valores fictícios para conhecer a interface. Nenhuma chamada ao agente é feita neste modo."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {D.pons.map((p) => (
          <Card key={p.id} title={`PON ${p.id} (simulada)`}>
            <KV k={`${p.onus} ONUs`} v={<Status value={p.state} />} />
          </Card>
        ))}
      </section>
      <Card title="ONUs (simuladas)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-slate-500">
                <th className="py-2">ID</th>
                <th>Serial</th>
                <th>Status</th>
                <th>RX (dBm)</th>
              </tr>
            </thead>
            <tbody>
              {D.onus.map((o) => (
                <tr key={o.onuId} className="border-t border-white/[0.045]">
                  <td className="py-2 font-mono">{o.onuId}</td>
                  <td className="font-mono">{o.serial}</td>
                  <td>
                    <Status value={o.status} />
                  </td>
                  <td>{o.rxDbm ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Saída bruta (simulada)">
        <pre className="overflow-auto rounded-lg bg-[#05080f] p-4 font-mono text-[11px] text-fuchsia-200">
          {D.raw}
        </pre>
      </Card>
    </>
  );
}
