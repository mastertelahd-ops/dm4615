import {
  Activity, AlertTriangle, Bell, Cable, CircleHelp, Gauge, LayoutDashboard,
  Menu, Network, Plus, Search, Server, Settings, ShieldCheck, Signal,
  TerminalSquare, Wifi, X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DM4615 | Gestão de OLT" },
      { name: "description", content: "Painel de gestão e provisionamento de redes ópticas." },
    ],
  }),
  component: Index,
});

const olts = [
  { name: "OLT-POP-CENTRO", model: "Datacom DM4615", ip: "192.168.10.2", state: "Online", ports: "8/16", onus: 126, load: 34, temp: "42°C" },
  { name: "OLT-POP-NORTE", model: "Datacom DM4615", ip: "192.168.20.2", state: "Online", ports: "12/16", onus: 184, load: 58, temp: "47°C" },
  { name: "OLT-POP-SUL", model: "Datacom DM4615", ip: "192.168.30.2", state: "Atenção", ports: "5/16", onus: 73, load: 71, temp: "53°C" },
];
const initialOnus = [
  { id: "DTCM-A1B2C3D4", client: "Residencial • Cliente 001", olt: "OLT-POP-CENTRO", port: "1/1/3", status: "Online", rx: "-21.8 dBm", plan: "600 Mega" },
  { id: "DTCM-E5F6A7B8", client: "Comercial • Cliente 024", olt: "OLT-POP-NORTE", port: "1/1/7", status: "Online", rx: "-19.4 dBm", plan: "800 Mega" },
  { id: "DTCM-C9D0E1F2", client: "Residencial • Cliente 038", olt: "OLT-POP-SUL", port: "1/1/2", status: "Offline", rx: "—", plan: "400 Mega" },
  { id: "DTCM-11223344", client: "Residencial • Cliente 052", olt: "OLT-POP-CENTRO", port: "1/1/5", status: "Online", rx: "-23.1 dBm", plan: "500 Mega" },
];

const nav = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Equipamentos OLT", icon: Server },
  { label: "ONUs e clientes", icon: Wifi },
  { label: "Portas PON", icon: Cable },
  { label: "Provisionamento", icon: Network },
  { label: "Diagnóstico óptico", icon: Activity },
  { label: "Terminal", icon: TerminalSquare },
  { label: "Auditoria", icon: ShieldCheck },
];

function Index() {
  const [active, setActive] = useState("Visão geral");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [onus] = useState(initialOnus);
  const filteredOnus = useMemo(() => onus.filter((onu) =>
    [onu.id, onu.client, onu.olt, onu.port].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [onus, query]);

  return (
    <div className="min-h-screen bg-[#080d17] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[0.07] bg-[#0c1320] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><Network size={22}/></div>
          <div><div className="text-[17px] font-bold tracking-wide">DM<span className="text-cyan-300">4615</span></div><div className="text-[10px] uppercase tracking-[.2em] text-slate-500">Network manager</div></div>
          <button className="ml-auto text-slate-500 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={18}/></button>
        </div>
        <div className="px-4 pt-6"><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">Workspace</div>
          <nav className="space-y-1">{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setActive(label);setMobileNav(false);}} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${active === label ? "bg-cyan-400/10 font-semibold text-cyan-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}><Icon size={17}/>{label}{label === "Auditoria" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400"/>}</button>)}</nav>
        </div>
        <div className="mt-auto p-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-300"><ShieldCheck size={15} className="text-emerald-400"/> Acesso protegido</div><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">As operações reais serão executadas pelo backend seguro.</p></div>
          <div className="mt-4 flex items-center gap-3 px-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold">AD</div><div className="min-w-0 flex-1"><div className="text-xs font-medium">Administrador</div><div className="text-[10px] text-slate-500">Ambiente de demonstração</div></div><Settings size={16} className="text-slate-500"/></div>
        </div>
      </aside>
      {mobileNav && <button aria-label="Fechar menu" className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}/>}
      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080d17]/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3"><button className="text-slate-400 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu/></button><div><div className="text-sm font-semibold">{active}</div><div className="mt-0.5 text-[11px] text-slate-500">Infraestrutura / {active}</div></div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1.5 text-[10px] font-medium text-amber-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"/> DEMONSTRAÇÃO</div><button className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5" aria-label="Notificações"><Bell size={18}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400"/></button><div className="h-8 w-8 rounded-full border border-white/10 bg-gradient-to-br from-cyan-400/30 to-blue-500/20"/></div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
          <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-cyan-300"><span className="h-px w-5 bg-cyan-300"/> Network operations center</div><h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Visão geral da rede</h1><p className="mt-1.5 text-sm text-slate-500">Acompanhe seus equipamentos, portas PON e assinantes em um só lugar.</p></div><button onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"><Plus size={16}/> Cadastrar OLT</button></section>
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.055] px-4 py-3"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300"/><div><div className="text-xs font-semibold text-amber-200">Dados demonstrativos</div><p className="mt-1 text-[11px] leading-relaxed text-amber-100/60">Os equipamentos, clientes e indicadores abaixo são exemplos visuais. Nenhuma OLT está conectada e nenhuma ação de provisionamento é executada nesta versão.</p></div></div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Server} label="Equipamentos OLT" value="03" detail="2 online • 1 atenção" tone="cyan"/>
            <Metric icon={Wifi} label="ONUs identificadas" value="383" detail="Em todos os equipamentos" tone="blue"/>
            <Metric icon={Signal} label="ONUs online" value="371" detail="96,9% de disponibilidade" tone="green"/>
            <Metric icon={Gauge} label="Portas PON em uso" value="25 / 48" detail="52% de ocupação" tone="violet"/>
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className="rounded-xl border border-white/[0.07] bg-[#0c1320] p-5">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Equipamentos monitorados</h2><p className="mt-1 text-[11px] text-slate-500">Estado operacional dos pontos de acesso</p></div><button onClick={() => setActive("Equipamentos OLT")} className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200">Ver equipamentos →</button></div>
              <div className="space-y-3">{olts.map((olt) => <div key={olt.name} className="rounded-lg border border-white/[0.06] bg-white/[0.018] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/[0.08] text-cyan-300"><Server size={17}/></div><div><div className="text-xs font-semibold">{olt.name}</div><div className="mt-1 text-[10px] text-slate-500">{olt.model} <span className="px-1.5">•</span>{olt.ip}</div></div></div><Status value={olt.state}/></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3"><SmallStat label="ONUs" value={String(olt.onus)}/><SmallStat label="Portas PON" value={olt.ports}/><SmallStat label="Temperatura" value={olt.temp}/></div><div className="mt-3 flex items-center gap-3"><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${olt.load > 65 ? "bg-amber-400" : "bg-cyan-400"}`} style={{width: olt.load+"%"}}/></div><span className="text-[10px] tabular-nums text-slate-500">CPU {olt.load}%</span></div></div>)}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-[#0c1320] p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Saúde da infraestrutura</h2><p className="mt-1 text-[11px] text-slate-500">Resumo ilustrativo do ambiente</p></div><Activity size={17} className="text-cyan-300"/></div><div className="mt-6 flex items-center justify-center"><div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{background:"conic-gradient(#22d3ee 0 96.9%, #263345 96.9% 100%)"}}><div className="flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full bg-[#0c1320]"><span className="text-3xl font-semibold tracking-tight">96,9<span className="text-base">%</span></span><span className="mt-1 text-[10px] text-slate-500">Disponibilidade</span></div></div></div><div className="mt-6 space-y-3"><HealthLine label="Equipamentos online" value="2 de 3" color="bg-emerald-400"/><HealthLine label="ONUs online" value="371 de 383" color="bg-cyan-400"/><HealthLine label="Alertas pendentes" value="02" color="bg-amber-400"/></div></div>
          </section>
          <section className="rounded-xl border border-white/[0.07] bg-[#0c1320]">
            <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold">Últimas ONUs</h2><p className="mt-1 text-[11px] text-slate-500">Visão rápida dos assinantes cadastrados</p></div><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ONU, cliente ou OLT..." className="w-full rounded-lg border border-white/10 bg-[#080d17] py-2 pl-9 pr-3 text-xs outline-none placeholder:text-slate-600 focus:border-cyan-400/50 sm:w-64"/></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-medium">Identificação ONU</th><th className="px-4 py-3 font-medium">OLT / Porta</th><th className="px-4 py-3 font-medium">Plano</th><th className="px-4 py-3 font-medium">Sinal RX</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{filteredOnus.map((onu) => <tr key={onu.id} className="border-t border-white/[0.045] text-xs hover:bg-white/[0.02]"><td className="px-5 py-3.5"><div className="font-medium text-slate-200">{onu.id}</div><div className="mt-1 text-[10px] text-slate-500">{onu.client}</div></td><td className="px-4 py-3.5"><div className="text-slate-300">{onu.olt}</div><div className="mt-1 text-[10px] text-slate-500">{onu.port}</div></td><td className="px-4 py-3.5 text-slate-400">{onu.plan}</td><td className="px-4 py-3.5 font-mono text-slate-400">{onu.rx}</td><td className="px-5 py-3.5"><Status value={onu.status}/></td></tr>)}</tbody></table>{filteredOnus.length===0 && <div className="p-8 text-center text-xs text-slate-500">Nenhuma ONU encontrada para esta busca.</div>}</div>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[10px] text-slate-500"><span>Exibindo {filteredOnus.length} registros demonstrativos</span><button onClick={() => setActive("ONUs e clientes")} className="font-medium text-cyan-300">Abrir gestão de ONUs →</button></div>
          </section>
          <footer className="flex flex-col justify-between gap-2 pb-3 text-[10px] text-slate-600 sm:flex-row"><span>DM4615 Network Manager • Arquitetura multi-fabricante</span><span className="flex items-center gap-1.5"><CircleHelp size={12}/> Datacom DM4615 • Driver de comunicação pendente</span></footer>
        </div>
      </main>
      {showAdd && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowAdd(false)}><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101a2a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><div><h3 className="font-semibold">Cadastrar equipamento OLT</h3><p className="mt-1 text-xs text-slate-500">Prévia da tela de cadastro</p></div><button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white" aria-label="Fechar"><X size={18}/></button></div><div className="mt-5 space-y-3"><Field label="Nome do equipamento" placeholder="Ex.: OLT-POP-LESTE"/><Field label="Endereço IP de gerenciamento" placeholder="192.168.1.10"/><label className="block text-xs text-slate-400">Fabricante e modelo<select className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none"><option>Datacom DM4615</option><option>Huawei (driver futuro)</option><option>ZTE (driver futuro)</option></select></label><label className="block text-xs text-slate-400">Porta de gerenciamento<input defaultValue="22" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none"/></label></div><div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-[11px] leading-relaxed text-amber-200/80">Cadastro real depende de backend, armazenamento seguro de credenciais e agente de rede. Este formulário é apenas demonstrativo e não salva dados.</div><button onClick={() => setShowAdd(false)} className="mt-5 w-full rounded-lg bg-cyan-400 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300">Entendi</button></div></div>}
    </div>
  );
}

function Metric({icon: Icon, label, value, detail, tone}: {icon: typeof Server; label: string; value: string; detail: string; tone: string}) {
  const tones: Record<string,string> = {cyan:"text-cyan-300 bg-cyan-400/10",blue:"text-blue-300 bg-blue-400/10",green:"text-emerald-300 bg-emerald-400/10",violet:"text-violet-300 bg-violet-400/10"};
  return <div className="rounded-xl border border-white/[0.07] bg-[#0c1320] p-4"><div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={16}/></span></div><div className="mt-3 text-[26px] font-semibold tracking-tight">{value}</div><div className="mt-1 text-[10px] text-slate-500">{detail}</div></div>;
}
function Status({value}: {value:string}) { const good=value==="Online"; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${good?"bg-emerald-400/10 text-emerald-300":value==="Offline"?"bg-slate-500/10 text-slate-400":"bg-amber-400/10 text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${good?"bg-emerald-400":value==="Offline"?"bg-slate-500":"bg-amber-400"}`}/>{value}</span>; }
function SmallStat({label,value}: {label:string;value:string}) { return <div><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 text-xs font-semibold text-slate-300">{value}</div></div>; }
function HealthLine({label,value,color}: {label:string;value:string;color:string}) { return <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${color}`}/>{label}</span><span className="font-medium text-slate-300">{value}</span></div>; }
function Field({label,placeholder}: {label:string;placeholder:string}) { return <label className="block text-xs text-slate-400">{label}<input placeholder={placeholder} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"/></label>; }
