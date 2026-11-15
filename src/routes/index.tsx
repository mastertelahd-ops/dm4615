import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, Cable, Gauge, LayoutDashboard, Lock, Menu, Network, PlugZap,
  RefreshCw, Server, ShieldCheck, TerminalSquare, Wifi, X,
} from "lucide-react";
import { AgentProvider, useAgent } from "@/lib/agent-context";
import { AGENT_ROUTES, AgentUnavailableError, READ_ONLY_COMMANDS, type Capability, type CollectResult } from "@/lib/agent-api";
import { MANUAL_SNAPSHOT as S } from "@/lib/olt-snapshot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DM4615 | Gestão de OLT" },
      { name: "description", content: "Painel operacional somente leitura para OLT Datacom DM4615 via agente local Windows." },
      { property: "og:title", content: "DM4615 | Gestão de OLT" },
      { property: "og:description", content: "Painel operacional somente leitura para OLT Datacom DM4615 via agente local Windows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AgentProvider><Index /></AgentProvider>,
});

const nav = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Conexão do agente", icon: PlugZap },
  { label: "Equipamentos", icon: Server },
  { label: "Portas PON", icon: Cable },
  { label: "ONUs", icon: Wifi },
  { label: "Diagnóstico", icon: Activity },
  { label: "Terminal", icon: TerminalSquare },
  { label: "Auditoria", icon: ShieldCheck },
] as const;
type Section = (typeof nav)[number]["label"];

interface AuditEntry { at: Date; action: string; result: string }
const fmt = (n: number) => n.toLocaleString("pt-BR");

function Index() {
  const [active, setActive] = useState<Section>("Visão geral");
  const [mobileNav, setMobileNav] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const log = (action: string, result: string) => setAudit((a) => [{ at: new Date(), action, result }, ...a].slice(0, 200));
  const { online, health } = useAgent();

  return (
    <div className="min-h-screen bg-[#080d17] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[0.07] bg-[#0c1320] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><Network size={22} /></div>
          <div><div className="text-[17px] font-bold tracking-wide">DM<span className="text-cyan-300">4615</span></div><div className="text-[10px] uppercase tracking-[.2em] text-slate-500">Network manager</div></div>
          <button className="ml-auto text-slate-500 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <nav className="space-y-1 px-4 pt-6">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => { setActive(label); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${active === label ? "bg-cyan-400/10 font-semibold text-cyan-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}><Icon size={17} />{label}</button>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-300"><Lock size={15} className="text-emerald-400" /> Somente leitura</div><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Escrita, provisionamento e reboot estão bloqueados nesta versão.</p></div>
        </div>
      </aside>
      {mobileNav && <button aria-label="Fechar menu" className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)} />}
      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080d17]/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3"><button className="text-slate-400 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button><div><div className="text-sm font-semibold">{active}</div><div className="mt-0.5 text-[11px] text-slate-500">{S.olt.vendor} {S.olt.model} • {S.olt.ip}</div></div></div>
          <button onClick={() => setActive("Conexão do agente")} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium ${online ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300" : "border-slate-500/30 bg-white/[0.03] text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />AGENTE {online ? "ONLINE" : health ? "OFFLINE" : "NÃO TESTADO"}
          </button>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          {active === "Visão geral" && <Overview go={setActive} />}
          {active === "Conexão do agente" && <Connection log={log} />}
          {active === "Equipamentos" && <Equipment />}
          {active === "Portas PON" && <PonPorts log={log} />}
          {active === "ONUs" && <Onus log={log} />}
          {active === "Diagnóstico" && <Diagnostics />}
          {active === "Terminal" && <Terminal log={log} />}
          {active === "Auditoria" && <Audit entries={audit} />}
        </div>
      </main>
    </div>
  );
}

function Title({ kicker, title, desc, children }: { kicker: string; title: string; desc: string; children?: ReactNode }) {
  return <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-cyan-300"><span className="h-px w-5 bg-cyan-300" /> {kicker}</div><h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1><p className="mt-1.5 text-sm text-slate-500">{desc}</p></div>{children}</section>;
}
function Card({ title, desc, children, right }: { title: string; desc?: string; children: ReactNode; right?: ReactNode }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#0c1320] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{title}</h2>{desc && <p className="mt-1 text-[11px] text-slate-500">{desc}</p>}</div>{right}</div>{children}</div>;
}
function ManualBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2 py-1 text-[10px] font-medium text-amber-300">Última coleta manual confirmada</span>;
}
function Notice({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "slate" | "red" }) {
  const c = { amber: "border-amber-400/20 bg-amber-400/[0.055] text-amber-100/80", slate: "border-white/10 bg-white/[0.03] text-slate-400", red: "border-red-400/20 bg-red-400/[0.06] text-red-200" }[tone];
  return <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[11px] leading-relaxed ${c}`}><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}
function Status({ value }: { value: string }) {
  const good = value === "Up" || value === "Online";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${good ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-emerald-400" : "bg-slate-500"}`} />{value}</span>;
}
function KV({ k, v }: { k: string; v: ReactNode }) { return <div><div className="text-[10px] text-slate-500">{k}</div><div className="mt-1 text-xs font-semibold text-slate-300">{v}</div></div>; }
function Btn({ onClick, disabled, children, icon: Icon = RefreshCw }: { onClick?: () => void; disabled?: boolean; children: ReactNode; icon?: typeof RefreshCw }) {
  return <button onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"><Icon size={15} />{children}</button>;
}

function Overview({ go }: { go: (s: Section) => void }) {
  const { online } = useAgent();
  const up = S.onus.filter((o) => o.status === "Up").length;
  return <>
    <Title kicker="Network operations center" title="Visão geral" desc="Dados reais da OLT. Sem agente conectado, exibimos apenas a última coleta manual confirmada." />
    {!online && <Notice>O agente local não está conectado. Os dados abaixo são da <b>última coleta manual</b> e não indicam que a OLT esteja online agora. <button className="font-semibold text-cyan-300" onClick={() => go("Conexão do agente")}>Conectar agente →</button></Notice>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="OLT" right={<ManualBadge />}><KV k={`${S.olt.vendor} ${S.olt.model}`} v={`${S.olt.ip} • SSH ${S.olt.sshPort}`} /></Card>
      <Card title="PON testada"><KV k={S.pon.type} v={`${S.pon.id} • ${S.pon.adminState}/${S.pon.operState}`} /></Card>
      <Card title="ONUs na PON 1/1/2"><KV k="Total identificado" v={`${S.onus.length} (${up} Up, ${S.onus.length - up} Down)`} /></Card>
      <Card title="Banda upstream disponível (CBR)"><KV k="kbit/s" v={fmt(S.pon.upstreamKbps.availableCbr)} /></Card>
    </section>
    <OnuTable />
  </>;
}

function Connection({ log }: { log: (a: string, r: string) => void }) {
  const { url, setUrl, saveUrl, token, setToken, health, checking, lastCheck, test } = useAgent();
  const [saved, setSaved] = useState(false);
  const run = async () => { await test(); };
  return <>
    <Title kicker="Agente local Windows" title="Conexão do agente" desc="O agente roda nesta máquina e é quem acessa a OLT via SSH. A senha SSH nunca passa pelo navegador." />
    <section className="grid gap-5 xl:grid-cols-2">
      <Card title="Configuração">
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">URL do agente<input value={url} onChange={(e) => { setUrl(e.target.value); setSaved(false); }} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400/50" /></label>
          <label className="block text-xs text-slate-400">Token do agente (fica só na memória desta sessão)<input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400/50" /></label>
          <div className="flex flex-wrap gap-2">
            <Btn icon={PlugZap} disabled={checking} onClick={async () => { await run(); log("Testar conexão (GET /health)", "executado"); }}>{checking ? "Testando..." : "Testar conexão"}</Btn>
            <button onClick={() => { saveUrl(); setSaved(true); log("Salvar URL do agente", url); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Salvar URL</button>
            {saved && <span className="self-center text-[11px] text-emerald-300">URL salva neste navegador.</span>}
          </div>
          <p className="text-[11px] text-slate-500">O token não é salvo: ao recarregar a página, informe-o novamente.</p>
        </div>
      </Card>
      <Card title="Estado" desc={lastCheck ? `Último teste: ${lastCheck.toLocaleTimeString("pt-BR")}` : "Ainda não testado"}>
        {!health && <Notice tone="slate">Clique em “Testar conexão” para verificar o endpoint /health.</Notice>}
        {health && !health.ok && <Notice tone="red"><b>Offline.</b> {health.message}</Notice>}
        {health?.ok && <div className="space-y-3"><Status value="Online" /><div className="grid grid-cols-3 gap-3"><KV k="Status" v={health.info.status} /><KV k="Versão" v={health.info.version ?? "—"} /><KV k="Latência" v={`${health.latencyMs} ms`} /></div>
          <div className="text-[11px] text-slate-400">Consultas disponíveis:</div>
          <ul className="space-y-1 text-[11px]">{(Object.keys(AGENT_ROUTES) as Capability[]).map((c) => <li key={c} className="flex justify-between gap-2"><span className="font-mono text-slate-400">{c}</span>{health.info.capabilities.includes(c) ? <span className="text-emerald-300">disponível</span> : <span className="text-slate-500">não implementada</span>}</li>)}</ul></div>}
      </Card>
    </section>
  </>;
}

function Equipment() {
  return <>
    <Title kicker="Inventário" title="Equipamentos" desc="Equipamentos confirmados. Cadastro de novas OLTs depende do agente." />
    <Card title={`${S.olt.vendor} ${S.olt.model}`} right={<ManualBadge />}>
      <div className="grid gap-3 sm:grid-cols-4"><KV k="IP de gerenciamento" v={S.olt.ip} /><KV k="Acesso" v={`SSH TCP/${S.olt.sshPort}`} /><KV k="PON testada" v={S.pon.id} /><KV k="Estado atual" v="Desconhecido (sem coleta ao vivo)" /></div>
    </Card>
  </>;
}

function useCollect(cap: Capability, fn: () => Promise<CollectResult>, label: string, log: (a: string, r: string) => void) {
  const { online, health } = useAgent();
  const [state, setState] = useState<{ loading: boolean; result?: CollectResult; error?: string }>({ loading: false });
  const available = online && health?.ok && health.info.capabilities.includes(cap);
  const run = async () => {
    setState({ loading: true });
    try { const r = await fn(); setState({ loading: false, result: r }); log(label, "sucesso"); }
    catch (e) { const m = e instanceof AgentUnavailableError ? e.message : e instanceof Error ? e.message : "Falha na consulta."; setState({ loading: false, error: m }); log(label, `falha: ${m}`); }
  };
  return { ...state, available, run, online };
}

function CollectView({ c, cap }: { c: ReturnType<typeof useCollect>; cap: Capability }) {
  if (!c.online) return <Notice tone="slate">Aguardando agente: conecte o agente para coletar dados ao vivo.</Notice>;
  if (!c.available) return <Notice tone="slate">Aguardando agente: consulta não implementada (<span className="font-mono">{AGENT_ROUTES[cap].method} {AGENT_ROUTES[cap].path}</span>).</Notice>;
  if (c.error) return <Notice tone="red">{c.error}</Notice>;
  if (!c.result) return null;
  return <div><div className="mb-2 text-[11px] text-slate-500">Coletado ao vivo em {new Date(c.result.collectedAt).toLocaleString("pt-BR")} • <span className="font-mono">{c.result.command}</span></div><pre className="max-h-96 overflow-auto rounded-lg bg-[#05080f] p-4 font-mono text-[11px] text-slate-300">{c.result.raw}</pre></div>;
}

function PonPorts({ log }: { log: (a: string, r: string) => void }) {
  const { client } = useAgent();
  const c = useCollect("gpon.interface.read", () => client.gponInterface(S.pon.id), `Consultar interface ${S.pon.id}`, log);
  const u = S.pon.upstreamKbps;
  return <>
    <Title kicker="GPON" title="Portas PON" desc="Estado da interface GPON testada."><Btn disabled={!c.available || c.loading} onClick={c.run}>{c.loading ? "Consultando..." : "Consultar interface"}</Btn></Title>
    <Card title={`PON ${S.pon.id}`} right={<ManualBadge />}>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KV k="Estado físico" v={`${S.pon.adminState} / ${S.pon.operState}`} /><KV k="Tipo" v={S.pon.type} /><KV k="FEC upstream / downstream" v={`${S.pon.fecUpstream} / ${S.pon.fecDownstream}`} /><KV k="Transceiver" v={S.pon.transceiver} />
        <KV k="Upstream máx." v={`${fmt(u.max)} kbit/s`} /><KV k="Disponível CBR" v={`${fmt(u.availableCbr)} kbit/s`} /><KV k="Total" v={`${fmt(u.total)} kbit/s`} /><KV k="Overhead" v={`${fmt(u.overhead)} kbit/s`} />
      </div>
    </Card>
    <Card title="Coleta ao vivo"><CollectView c={c} cap="gpon.interface.read" /></Card>
  </>;
}

function OnuTable() {
  return <Card title={`ONUs na PON ${S.pon.id}`} desc="Sem cliente/assinante atribuído: vínculo ainda não validado." right={<ManualBadge />}>
    <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2 font-medium">ONU ID</th><th className="py-2 font-medium">Serial</th><th className="py-2 font-medium">PON</th><th className="py-2 font-medium">Status</th></tr></thead>
      <tbody>{S.onus.map((o) => <tr key={o.onuId} className="border-t border-white/[0.045] text-xs"><td className="py-3 font-mono">{o.onuId}</td><td className="py-3 font-mono text-slate-200">{o.serial}</td><td className="py-3 text-slate-400">{S.pon.id}</td><td className="py-3"><Status value={o.status} /></td></tr>)}</tbody></table></div>
  </Card>;
}

function Onus({ log }: { log: (a: string, r: string) => void }) {
  const { client } = useAgent();
  const c = useCollect("gpon.onu.read", () => client.gponOnus(S.pon.id), `Listar ONUs ${S.pon.id}`, log);
  return <>
    <Title kicker="Assinantes" title="ONUs" desc="Potência óptica, distância e tráfego individual ainda não validados."><Btn disabled={!c.available || c.loading} onClick={c.run}>{c.loading ? "Listando..." : "Listar ONUs"}</Btn></Title>
    <OnuTable />
    <Card title="Coleta ao vivo"><CollectView c={c} cap="gpon.onu.read" /></Card>
    <Notice tone="slate">Provisionar, remover ou reiniciar ONUs está bloqueado até haver implementação e autorização explícita.</Notice>
  </>;
}

function Diagnostics() {
  return <>
    <Title kicker="Óptico" title="Diagnóstico" desc="Métricas ópticas individuais por ONU." />
    <Notice tone="slate">Aguardando agente: consulta não implementada. Potência RX/TX, distância e tráfego por ONU ainda não têm comando validado no DM4615 — nenhum valor é exibido para não apresentar dados inventados.</Notice>
  </>;
}

function Terminal({ log }: { log: (a: string, r: string) => void }) {
  const { client } = useAgent();
  const [cmd, setCmd] = useState<string>(READ_ONLY_COMMANDS[0]);
  const c = useCollect("cli.read", () => client.cliRead(cmd), `Terminal: ${cmd}`, log);
  return <>
    <Title kicker="CLI" title="Terminal" desc="Apenas comandos de leitura validados. Comandos livres e de configuração estão bloqueados." />
    <Card title="Executar comando">
      <div className="flex flex-col gap-2 sm:flex-row"><select value={cmd} onChange={(e) => setCmd(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 font-mono text-xs text-slate-200 outline-none">{READ_ONLY_COMMANDS.map((x) => <option key={x}>{x}</option>)}</select><Btn icon={TerminalSquare} disabled={!c.available || c.loading} onClick={c.run}>Executar</Btn></div>
      <div className="mt-4"><CollectView c={c} cap="cli.read" /></div>
    </Card>
  </>;
}

function Audit({ entries }: { entries: AuditEntry[] }) {
  return <>
    <Title kicker="Rastreabilidade" title="Auditoria" desc="Ações desta sessão (somente em memória, sem token). Histórico persistente depende do agente." />
    <Card title="Ações da sessão">
      {entries.length === 0 ? <p className="text-xs text-slate-500">Nenhuma ação registrada nesta sessão.</p> :
        <ul className="divide-y divide-white/[0.05] text-xs">{entries.map((e, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span className="text-slate-300">{e.action}</span><span className="text-slate-500">{e.result} • {e.at.toLocaleTimeString("pt-BR")}</span></li>)}</ul>}
    </Card>
    <Card title="Bloqueios ativos"><div className="flex items-center gap-2 text-xs text-slate-400"><Gauge size={15} /> Escrita, provisionamento, configuração e reboot: bloqueados.</div></Card>
  </>;
}
