import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgent } from "@/lib/agent-context";
import { VALIDATED_PON } from "@/lib/agent-api";

type Customer = { id: string; full_name: string; document_number: string | null };
type Plan = { id: string; name: string; download_mbps: number; upload_mbps: number; price: number | null };
type Pon = { id: string; interface_name: string };
type Onu = { id: string; serial_number: string; onu_number: number | null; status: string; customer_id: string | null; service_plan_id: string | null; pon_port_id: string | null; last_seen_at: string | null; metadata: Record<string, unknown> };
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [collectedAt, setCollectedAt] = useState<string | null>(null);

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

  const scan = useCallback(async () => {
    if (!online || !health?.ok || !health.info.capabilities.includes("gpon.onu.read")) {
      setError("Agente sem consulta GPON disponível. Conecte o agente Windows e valide o acesso à OLT.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await client.gponOnus(VALIDATED_PON);
      const parsed: { onuNumber: number; serial: string; state: "Up" | "Down" }[] = [];
      const line = /^\s*1\/1\/2\s+(\d+)\s+([A-Z0-9]+)\s+(Up|Down)\b/gim;
      for (const m of result.raw.matchAll(line)) parsed.push({ onuNumber: Number(m[1]), serial: m[2], state: m[3] as "Up" | "Down" });
      if (!parsed.length) throw new Error("A OLT respondeu, mas nenhuma ONU foi reconhecida no formato esperado. Nenhum status foi alterado.");

      const { data: olt, error: oltError } = await supabase.from("olt_devices").upsert({
        name: "OLT principal",
        vendor: "Datacom",
        model: "DM4615",
        management_host: "192.168.0.25",
        management_port: 22,
        enabled: true,
      }, { onConflict: "vendor,model,management_host" }).select("id").single();
      if (oltError) throw oltError;
      // Inventário das interfaces físicas já identificadas na DM4615.
      // A coleta ao vivo continua validada somente em 1/1/2 nesta versão.
      const ponIds = new Map<string, string>();
      for (let n = 1; n <= 16; n++) {
        const interfaceName = `1/1/${n}`;
        const { data: port, error: portError } = await supabase.from("pon_ports").upsert({
          olt_id: olt.id,
          interface_name: interfaceName,
          enabled: true,
        }, { onConflict: "olt_id,interface_name" }).select("id").single();
        if (portError) throw portError;
        ponIds.set(interfaceName, port.id);
      }
      const detectedPonId = ponIds.get(VALIDATED_PON);
      if (!detectedPonId) throw new Error("PON validada não foi registrada no inventário.");

      for (const item of parsed) {
        const { data: existing, error: findError } = await supabase.from("onus").select("id,customer_id").eq("serial_number", item.serial).maybeSingle();
        if (findError) throw findError;
        const status = existing?.customer_id ? (item.state === "Up" ? "online" : "offline") : "unregistered";
        let savedId = existing?.id;
        if (existing) {
          const { error: updateError } = await supabase.from("onus").update({
            onu_number: item.onuNumber,
            olt_id: olt.id,
            pon_port_id: detectedPonId,
            status,
            last_seen_at: result.collectedAt,
            metadata: { observed_oper_state: item.state, observed_pon: VALIDATED_PON, source_command: result.command },
          }).eq("id", existing.id);
          if (updateError) throw updateError;
        } else {
          const { data: inserted, error: insertError } = await supabase.from("onus").insert({
            serial_number: item.serial,
            onu_number: item.onuNumber,
            olt_id: olt.id,
            pon_port_id: detectedPonId,
            status: "unregistered",
            last_seen_at: result.collectedAt,
            metadata: { observed_oper_state: item.state, observed_pon: VALIDATED_PON, source_command: result.command },
          }).select("id").single();
          if (insertError) throw insertError;
          savedId = inserted.id;
        }
        if (!savedId) throw new Error("Não foi possível identificar a ONU persistida.");
        const { error: observationError } = await supabase.from("onu_observations").insert({
          onu_id: savedId,
          serial_number: item.serial,
          olt_id: olt.id,
          pon_port_id: pon.id,
          observed_status: item.state === "Up" ? "online" : "offline",
          observed_at: result.collectedAt,
          raw_data: { onu_number: item.onuNumber, oper_state: item.state, command: result.command, pon: VALIDATED_PON },
        });
        if (observationError) throw observationError;
      }
      setCollectedAt(result.collectedAt);
      setNotice(`Coleta concluída: ${parsed.length} ONU(s) lida(s) na PON ${VALIDATED_PON}. Histórico gravado.`);
      log("ok", "Descoberta GPON", `${parsed.length} ONU(s) sincronizadas em ${VALIDATED_PON}`);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha na coleta ou gravação.";
      setError(message);
      log("erro", "Descoberta GPON", message);
    } finally {
      setLoading(false);
    }
  }, [client, health, online, log, loadData]);

  useEffect(() => { void loadData().catch(e => setError(e.message ?? "Falha ao carregar cadastros.")); }, [loadData]);
  useEffect(() => {
    if (!online) return;
    void scan();
    const timer = window.setInterval(() => void scan(), 30_000);
    return () => window.clearInterval(timer);
  }, [online, scan]);

  const currentOnu = useMemo(() => onus.find(o => o.id === selected) ?? null, [onus, selected]);
  const customerName = (id: string | null) => customers.find(c => c.id === id)?.full_name ?? "Sem cliente";
  const planName = (id: string | null) => plans.find(p => p.id === id)?.name ?? "Sem plano";
  const ponName = (id: string | null) => pons.find(p => p.id === id)?.interface_name ?? "PON não cadastrada";

  async function prepareRequest() {
    if (!currentOnu || !customerId || !planId || !targetPonId) {
      setError("Selecione ONU, cliente, plano e PON de destino.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = {
        serial_number: currentOnu.serial_number,
        source_pon: ponName(currentOnu.pon_port_id),
        target_pon: ponName(targetPonId),
        customer_id: customerId,
        service_plan_id: planId,
        profile_type: profile,
        preparation_only: true,
        note: "Comandos de escrita ainda bloqueados no agente; esta solicitação aguarda aprovação e validação técnica.",
      };
      const { data: userData } = await supabase.auth.getUser();
      const { error: reqError } = await supabase.from("provisioning_requests").insert({
        onu_id: currentOnu.id,
        requested_by: userData.user?.id ?? null,
        target_pon_port_id: targetPonId,
        profile_type: profile,
        status: "pending_approval",
        request_payload: payload,
      });
      if (reqError) throw reqError;
      const { error: onuError } = await supabase.from("onus").update({
        customer_id: customerId,
        service_plan_id: planId,
        status: "pending_approval",
        profile_type: profile,
      }).eq("id", currentOnu.id);
      if (onuError) throw onuError;
      await supabase.from("audit_events").insert({
        actor_user_id: userData.user?.id ?? null,
        event_type: "provisioning.request_created",
        entity_type: "onu",
        entity_id: currentOnu.id,
        outcome: "success",
        details: payload,
      });
      setNotice("Solicitação preparada e enviada para aprovação. Nenhum comando foi enviado à OLT.");
      setSelected("");
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
        approved_by: decision === "approved" ? userData.user?.id : null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        approval_note: decision === "approved" ? "Aprovado pelo administrador. Aguardando habilitação técnica do executor OLT." : "Rejeitado pelo administrador.",
      }).eq("id", request.id).eq("status", "pending_approval");
      if (updateError) throw updateError;
      await supabase.from("audit_events").insert({
        actor_user_id: userData.user?.id ?? null,
        event_type: decision === "approved" ? "provisioning.approved" : "provisioning.rejected",
        entity_type: "provisioning_request",
        entity_id: request.id,
        outcome: "success",
        details: { serial_number: request.request_payload.serial_number, decision },
      });
      setNotice(decision === "approved" ? "Aprovado e registrado. A execução permanece bloqueada até validar os comandos de escrita da DM4615." : "Solicitação rejeitada e registrada.");
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao registrar decisão."); }
    finally { setSaving(false); }
  }

  const stateText = (onu: Onu) => String(onu.metadata?.observed_oper_state ?? onu.status).toUpperCase();
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">DM4615 • GPON</p><h1 className="mt-2 text-3xl font-bold">Descoberta e autoprovisionamento</h1><p className="mt-2 text-sm text-slate-400">Detecção automática, vínculo com cliente/plano e fila de aprovação administrativa.</p></div>
        <div className="flex items-center gap-3"><span className={online ? "rounded-full bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300" : "rounded-full bg-rose-400/10 px-3 py-2 text-xs text-rose-300"}>{online ? "Agente conectado" : "Agente desconectado"}</span><button disabled={loading} onClick={() => void scan()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{loading ? "Consultando..." : "Buscar agora"}</button></div>
      </header>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100"><b>Modo protegido:</b> a coleta e a preparação de solicitações estão habilitadas. A aprovação fica registrada, mas a execução de comandos de escrita continua bloqueada até validar os comandos e os modelos reais de ONU da DM4615.</div>
      {error && <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="font-semibold">ONUs detectadas na PON {VALIDATED_PON}</h2><span className="text-xs text-slate-400">{collectedAt ? "Última coleta: " + new Date(collectedAt).toLocaleString("pt-BR") : "Aguardando coleta"}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">ONU</th><th className="p-2">Serial</th><th className="p-2">Estado OLT</th><th className="p-2">Cliente</th><th className="p-2">Plano</th><th className="p-2">PON</th><th className="p-2"></th></tr></thead><tbody>{onus.map(o => <tr key={o.id} className="border-t border-white/5"><td className="p-2">{o.onu_number ?? "—"}</td><td className="p-2 font-mono">{o.serial_number}</td><td className="p-2"><span className={stateText(o) === "UP" || stateText(o) === "ONLINE" ? "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-rose-400/10 px-2 py-1 text-xs text-rose-300"}>{stateText(o)}</span></td><td className="p-2">{customerName(o.customer_id)}</td><td className="p-2">{planName(o.service_plan_id)}</td><td className="p-2">{ponName(o.pon_port_id)}</td><td className="p-2"><button onClick={() => {setSelected(o.id);setCustomerId(o.customer_id ?? "");setPlanId(o.service_plan_id ?? "");setTargetPonId(o.pon_port_id ?? pons[0]?.id ?? "");}} className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-200">Preparar</button></td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-slate-500">Nesta versão, somente a PON 1/1/2 foi validada para coleta ao vivo. Outras PONs só entram na lista de destino quando cadastradas e validadas.</p>
      </section>
      {currentOnu && <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4"><h2 className="font-semibold">Preparar solicitação • {currentOnu.serial_number}</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">Cliente<select value={customerId} onChange={e=>setCustomerId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}{c.document_number ? " • "+c.document_number : ""}</option>)}</select></label>
        <label className="text-xs text-slate-300">Plano<select value={planId} onChange={e=>setPlanId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar plano</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} • {p.download_mbps}/{p.upload_mbps} Mbps</option>)}</select></label>
        <label className="text-xs text-slate-300">PON de destino<select value={targetPonId} onChange={e=>setTargetPonId(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="">Selecionar PON</option>{pons.map(p=><option key={p.id} value={p.id}>{p.interface_name}</option>)}</select></label>
        <label className="text-xs text-slate-300">Perfil<select value={profile} onChange={e=>setProfile(e.target.value as "bridge"|"router")} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-sm"><option value="bridge">Bridge</option><option value="router">Router</option></select></label>
      </div><div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={()=>void prepareRequest()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? "Salvando..." : "Enviar para aprovação"}</button><button onClick={()=>setSelected("")} className="rounded-lg border border-white/10 px-4 py-2 text-sm">Cancelar</button></div></section>}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><h2 className="mb-3 font-semibold">Fila de aprovação</h2><div className="space-y-3">{requests.length===0 && <p className="text-sm text-slate-500">Nenhuma solicitação registrada.</p>}{requests.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3"><div><div className="font-mono text-sm">{String(r.request_payload.serial_number ?? r.onu_id)}</div><div className="mt-1 text-xs text-slate-400">Perfil {r.profile_type.toUpperCase()} • Destino {String(r.request_payload.target_pon ?? "não definido")} • {new Date(r.created_at).toLocaleString("pt-BR")}</div><div className="mt-1 text-xs text-slate-400">Status: {r.status}</div></div>{r.status==="pending_approval" && <div className="flex gap-2"><button disabled={saving} onClick={()=>void decideRequest(r,"approved")} className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">Aprovar</button><button disabled={saving} onClick={()=>void decideRequest(r,"rejected")} className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-300">Rejeitar</button></div>}</div>)}</div></section>
      <p className="text-xs text-slate-500">Atualização automática a cada 30 segundos enquanto o agente estiver conectado. As observações são persistidas no banco Lovable Cloud existente.</p>
    </div>
  </main>;
}
