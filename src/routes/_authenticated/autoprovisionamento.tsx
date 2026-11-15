import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgent } from "@/lib/agent-context";
import { PON_LIST, mapLimit, onusFrom } from "@/lib/agent-api";

type Customer = { id: string; full_name: string; document_number: string | null };
type Plan = { id: string; name: string; download_mbps: number; upload_mbps: number; price: number | null };
type Pon = { id: string; interface_name: string };
type Onu = { id: string; serial_number: string; onu_number: number | null; status: string; customer_id: string | null; service_plan_id: string | null; pon_port_id: string | null; last_seen_at: string | null; metadata: Record<string, unknown> };
type DetectedOnu = { pon: string; onuNumber: number | null; serial: string; state: string };
type RequestRow = { id: string; onu_id: string; profile_type: "bridge" | "router"; status: string; request_payload: Record<string, unknown>; created_at: string; approval_note: string | null; target_pon_port_id: string | null };

export const Route = createFileRoute("/_authenticated/autoprovisionamento")({
  ssr: false,
  component: AutoProvisioning,
});

function AutoProvisioning() {
  const { client, online, health, log } = useAgent();
  const [onus, setOnus] = useState<Onu[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pons, setPons] = useState<Pon[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [targetPonId, setTargetPonId] = useState("");
  const [profile, setProfile] = useState<"bridge" | "router">("bridge");
  const [operation, setOperation] = useState<"provision" | "deprovision">("provision");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [collectedAt, setCollectedAt] = useState<string | null>(null);
  const [detectedOnus, setDetectedOnus] = useState<DetectedOnu[]>([]);
  const [scanErrors, setScanErrors] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const [o, c, p, pp, r] = await Promise.all([
      supabase.from("onus").select("*").order("serial_number"),
      supabase.from("customers").select("id,full_name,document_number").order("full_name"),
      supabase.from("service_plans").select("id,name,download_mbps,upload_mbps,price").eq("is_active", true).order("name"),
      supabase.from("pon_ports").select("id,interface_name").eq("enabled", true).order("interface_name"),
      supabase.from("provisioning_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const failure = [o.error, c.error, p.error, pp.error, r.error].find(Boolean);
    if (failure) throw failure;
    setOnus((o.data ?? []) as Onu[]);
    setCustomers((c.data ?? []) as Customer[]);
    setPlans((p.data ?? []) as Plan[]);
    setPons((pp.data ?? []) as Pon[]);
    setRequests((r.data ?? []) as RequestRow[]);
  }, []);

  /** Descoberta manual e somente leitura: nenhuma gravação no banco ou na OLT. */
  const scan = useCallback(async () => {
    if (!online || !health?.ok || !health.info.capabilities.includes("gpon.onu.read")) {
      setError("Agente sem consulta GPON disponível. Conecte o agente e confirme a capability gpon.onu.read.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const results = await mapLimit(PON_LIST, 4, async (pon) => {
        try {
          const result = await client.gponOnus(pon);
          const parsed = onusFrom(result, pon);
          if (parsed === null) {
            return { pon, onus: [] as DetectedOnu[], error: "Resposta sem lista de ONUs interpretável." };
          }
          return {
            pon,
            onus: parsed.map((onu) => ({ pon, onuNumber: onu.onuId, serial: onu.serial, state: onu.state })),
            error: null,
          };
        } catch (cause) {
          return {
            pon,
            onus: [] as DetectedOnu[],
            error: cause instanceof Error ? cause.message : "Falha na consulta.",
          };
        }
      });
      const found = results.flatMap((item) => item.onus);
      const failures = results.filter((item) => item.error).map((item) => `${item.pon}: ${item.error}`);
      setDetectedOnus(found);
      setScanErrors(failures);
      setCollectedAt(new Date().toISOString());
      setNotice(
        found.length
          ? `Leitura concluída: ${found.length} ONU(s) encontradas em ${PON_LIST.length} PONs. Nada foi gravado no banco.`
          : failures.length
            ? `Nenhuma ONU foi listada; ${failures.length} PON(s) apresentaram falha. Nada foi gravado no banco.`
            : "Leitura concluída: nenhuma ONU encontrada nas 16 PONs. Isso não é erro. Nada foi gravado no banco.",
      );
      log(failures.length ? "erro" : "ok", "Descoberta GPON somente leitura", `${found.length} ONU(s); ${failures.length} PON(s) com falha`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha na coleta GPON.";
      setError(message);
      log("erro", "Descoberta GPON somente leitura", message);
    } finally {
      setLoading(false);
    }
  }, [client, health, online, log]);

  useEffect(() => { void loadData().catch(e => setError(e.message ?? "Falha ao carregar cadastros.")); }, [loadData]);

  const currentOnu = useMemo(() => onus.find(o => o.id === selected) ?? null, [onus, selected]);
  const customerName = (id: string | null) => customers.find(c => c.id === id)?.full_name ?? "Sem cliente";
  const planName = (id: string | null) => plans.find(p => p.id === id)?.name ?? "Sem plano";
  const ponName = (id: string | null) => pons.find(p => p.id === id)?.interface_name ?? "PON não cadastrada";

  async function prepareRequest() {
    if (!currentOnu || (operation === "provision" && (!customerId || !planId || !targetPonId))) {
      setError(operation === "provision" ? "Para provisionar, selecione ONU, cliente, plano e PON de destino." : "Selecione uma ONU cadastrada para solicitar o desprovisionamento.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = {
        operation,
        serial_number: currentOnu.serial_number,
        source_pon: ponName(currentOnu.pon_port_id),
        target_pon: operation === "provision" ? ponName(targetPonId) : ponName(currentOnu.pon_port_id),
        customer_id: operation === "provision" ? customerId : currentOnu.customer_id,
        service_plan_id: operation === "provision" ? planId : currentOnu.service_plan_id,
        profile_type: profile,
        preparation_only: true,
        execution_enabled: false,
        note: "Solicitação registrada para teste de fluxo. Nenhum comando de escrita ou remoção foi enviado à OLT.",
      };
      const { data: userData } = await supabase.auth.getUser();
      const { error: reqError } = await supabase.from("provisioning_requests").insert({
        onu_id: currentOnu.id,
        requested_by: userData.user?.id ?? null,
        target_pon_port_id: operation === "provision" ? targetPonId : currentOnu.pon_port_id,
        profile_type: profile,
        status: "pending_approval",
        request_payload: payload,
      });
      if (reqError) throw reqError;
      // Não alterar o cadastro da ONU ao criar uma solicitação; a operação real segue bloqueada.
      await supabase.from("audit_events").insert({
        actor_user_id: userData.user?.id ?? null,
        event_type: operation === "provision" ? "provisioning.request_created" : "provisioning.deprovision_request_created",
        entity_type: "onu",
        entity_id: currentOnu.id,
        outcome: "success",
        details: payload,
      });
      setNotice(operation === "provision" ? "Solicitação de provisionamento registrada para aprovação/teste. Nenhum comando foi enviado à OLT." : "Solicitação de desprovisionamento registrada para aprovação/teste. A ONU permanece ativa; nenhum comando foi enviado à OLT.");
      setSelected("");
      setOperation("provision");
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível preparar a solicitação."); }
    finally { setSaving(false); }
  }

  async function decideRequest(request: RequestRow, decision: "approved" | "rejected") {
    setSaving(true); setError(""); setNotice("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("provisioning_requests").update({
        status: decision,
        approved_by: decision === "approved" ? (userData.user?.id ?? null) : null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        approval_note: decision === "approved" ? "Aprovado pelo administrador apenas para o fluxo de teste. Execução na OLT continua bloqueada." : "Rejeitado pelo administrador.",
      }).eq("id", request.id).eq("status", "pending_approval");
      if (updateError) throw updateError;
      await supabase.from("audit_events").insert({
        actor_user_id: userData.user?.id ?? null,
        event_type: decision === "approved" ? (String(request.request_payload["operation"] ?? "provision") === "deprovision" ? "provisioning.deprovision_approved" : "provisioning.approved") : "provisioning.rejected",
        entity_type: "provisioning_request",
        entity_id: request.id,
        outcome: "success",
        details: { serial_number: String(request.request_payload["serial_number"] ?? ""), decision },
      });
      setNotice(decision === "approved" ? "Aprovação de teste registrada. Nenhum provisionamento ou desprovisionamento foi executado na OLT." : "Solicitação rejeitada e registrada.");
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao registrar decisão."); }
    finally { setSaving(false); }
  }

  const stateText = (onu: Onu) => String(onu.metadata?.["observed_oper_state"] ?? onu.status).toUpperCase();
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">DM4615 • GPON</p><h1 className="mt-2 text-3xl font-bold">Descoberta e autoprovisionamento</h1><p className="mt-2 text-sm text-slate-400">Busca manual de ONUs em 16 PONs, sem gravação automática; vínculo e aprovação ficam separados.</p></div>
        <div className="flex items-center gap-3"><span className={online ? "rounded-full bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300" : "rounded-full bg-rose-400/10 px-3 py-2 text-xs text-rose-300"}>{online ? "Agente conectado" : "Agente desconectado"}</span><button disabled={loading || !online || !health?.ok || !health.info.capabilities.includes("gpon.onu.read")} onClick={() => void scan()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{loading ? "Consultando..." : "Buscar agora"}</button></div>
      </header>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100"><b>Modo protegido:</b> a coleta e a preparação de solicitações estão habilitadas. A aprovação fica registrada, mas a execução de comandos de escrita continua bloqueada até validar os comandos e os modelos reais de ONU da DM4615.</div>
      {error && <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}
      <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.035] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Descoberta atual • 16 PONs • somente leitura</h2>
          <span className="text-xs text-slate-400">{collectedAt ? `Última consulta: ${new Date(collectedAt).toLocaleString("pt-BR")}` : "Aguardando clique em Buscar agora"}</span>
        </div>
        <p className="mb-3 text-xs text-slate-400">Os seriais abaixo vêm diretamente do agente Windows. A coleta não cadastra ONUs, não altera clientes e não grava histórico no banco.</p>
        {scanErrors.length > 0 && <div role="alert" className="mb-3 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">{scanErrors.join(" • ")}</div>}
        {detectedOnus.length === 0 ? (
          <p className="text-sm text-slate-500">{collectedAt ? "Nenhuma ONU encontrada na última leitura." : "Nenhuma consulta executada ainda."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-slate-400"><tr><th className="p-2">PON</th><th className="p-2">ONU ID</th><th className="p-2">Serial</th><th className="p-2">Estado</th></tr></thead>
              <tbody>{detectedOnus.map((onu) => <tr key={`${onu.pon}-${onu.serial}`} className="border-t border-white/5"><td className="p-2 font-mono">{onu.pon}</td><td className="p-2">{onu.onuNumber ?? "—"}</td><td className="p-2 font-mono">{onu.serial}</td><td className="p-2"><span className={/^up$|online/i.test(onu.state) ? "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-200"}>{onu.state}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="font-semibold">ONUs já cadastradas no banco</h2><span className="text-xs text-slate-400">{collectedAt ? "Última coleta: " + new Date(collectedAt).toLocaleString("pt-BR") : "Aguardando coleta"}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">ONU</th><th className="p-2">Serial</th><th className="p-2">Estado OLT</th><th className="p-2">Cliente</th><th className="p-2">Plano</th><th className="p-2">PON</th><th className="p-2"></th></tr></thead><tbody>{onus.map(o => <tr key={o.id} className="border-t border-white/5"><td className="p-2">{o.onu_number ?? "—"}</td><td className="p-2 font-mono">{o.serial_number}</td><td className="p-2"><span className={stateText(o) === "UP" || stateText(o) === "ONLINE" ? "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-rose-400/10 px-2 py-1 text-xs text-rose-300"}>{stateText(o)}</span></td><td className="p-2">{customerName(o.customer_id)}</td><td className="p-2">{planName(o.service_plan_id)}</td><td className="p-2">{ponName(o.pon_port_id)}</td><td className="p-2"><button onClick={() => {setSelected(o.id);setCustomerId(o.customer_id ?? "");setPlanId(o.service_plan_id ?? "");setTargetPonId(o.pon_port_id ?? pons[0]?.id ?? "");}} className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-200">Preparar</button></td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-slate-500">Esta tabela mostra apenas registros já existentes no banco; a descoberta ao vivo acima é independente e não cria nem atualiza esses cadastros.</p>
      </section>
      {currentOnu && <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4"><h2 className="font-semibold">Preparar operação de teste • {currentOnu.serial_number}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOperation("provision")} className={operation === "provision" ? "rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950" : "rounded-md border border-white/10 px-3 py-2 text-xs"}>Provisionar (solicitação)</button>
          <button type="button" onClick={() => setOperation("deprovision")} className={operation === "deprovision" ? "rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950" : "rounded-md border border-white/10 px-3 py-2 text-xs"}>Desprovisionar (solicitação)</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {operation === "provision" && <>
            <label className="text-xs text-slate-300">Cliente<select value={customerId} onChange={e=>setCustomerId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}{c.document_number ? " • "+c.document_number : ""}</option>)}</select></label>
            <label className="text-xs text-slate-300">Plano<select value={planId} onChange={e=>setPlanId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar plano</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} • {p.download_mbps}/{p.upload_mbps} Mbps</option>)}</select></label>
            <label className="text-xs text-slate-300">PON de destino<select value={targetPonId} onChange={e=>setTargetPonId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar PON</option>{pons.map(p=><option key={p.id} value={p.id}>{p.interface_name}</option>)}</select></label>
            <label className="text-xs text-slate-300">Perfil<select value={profile} onChange={e=>setProfile(e.target.value as "bridge"|"router")} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="bridge">Bridge</option><option value="router">Router</option></select></label>
          </>}
        </div>
        <p className="mt-3 text-xs text-amber-200">Modo teste: a solicitação e a aprovação são registradas, mas nenhum comando é enviado à OLT e o cadastro da ONU não é alterado.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={()=>void prepareRequest()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? "Salvando..." : operation === "provision" ? "Solicitar provisionamento" : "Solicitar desprovisionamento"}</button><button onClick={()=>setSelected("")} className="rounded-lg border border-white/10 px-4 py-2 text-sm">Cancelar</button></div></section>}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><h2 className="mb-3 font-semibold">Fila de aprovação</h2><div className="space-y-3">{requests.length===0 && <p className="text-sm text-slate-500">Nenhuma solicitação registrada.</p>}{requests.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3"><div><div className="font-mono text-sm">{String(r.request_payload["serial_number"] ?? r.onu_id)}</div><div className="mt-1 text-xs text-slate-400">{String(r.request_payload["operation"] ?? "provision") === "deprovision" ? "DESPROVISIONAMENTO" : "PROVISIONAMENTO"} • Perfil {r.profile_type.toUpperCase()} • Destino {String(r.request_payload["target_pon"] ?? "não definido")} • {new Date(r.created_at).toLocaleString("pt-BR")}</div><div className="mt-1 text-xs text-slate-400">Status: {r.status}</div></div>{r.status==="pending_approval" && <div className="flex gap-2"><button disabled={saving} onClick={()=>void decideRequest(r,"approved")} className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">Aprovar</button><button disabled={saving} onClick={()=>void decideRequest(r,"rejected")} className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-300">Rejeitar</button></div>}</div>)}</div></section>
      <p className="text-xs text-slate-500">A descoberta GPON só ocorre ao clicar em Buscar agora. A coleta é somente leitura e não grava dados; solicitações e decisões administrativas são ações separadas.</p>
    </div>
  </main>;
}
