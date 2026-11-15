import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

type Customer = { id: string; full_name: string; document_number: string | null; email: string | null; phone: string | null; status: string; notes: string | null };
type Plan = { id: string; name: string; download_mbps: number; upload_mbps: number; price: number | null; is_active: boolean };

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros | DM4615" }, { name: "description", content: "Gestão de clientes e planos do DM4615." }] }),
  component: CadastrosPage,
});

function CadastrosPage() {
  const [tab, setTab] = useState<"clientes" | "planos">("clientes");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ id: "", full_name: "", document_number: "", email: "", phone: "", status: "active", notes: "" });
  const [plan, setPlan] = useState({ id: "", name: "", download_mbps: "300", upload_mbps: "150", price: "", is_active: true });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [c, p] = await Promise.all([
      supabase.from("customers").select("id,full_name,document_number,email,phone,status,notes").order("full_name"),
      supabase.from("service_plans").select("id,name,download_mbps,upload_mbps,price,is_active").order("download_mbps"),
    ]);
    if (c.error || p.error) setError(c.error?.message ?? p.error?.message ?? "Falha ao carregar cadastros.");
    else { setCustomers((c.data ?? []) as Customer[]); setPlans((p.data ?? []) as Plan[]); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveCustomer(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);
    const payload = { full_name: customer.full_name.trim(), document_number: customer.document_number.trim() || null, email: customer.email.trim() || null, phone: customer.phone.trim() || null, status: customer.status, notes: customer.notes.trim() || null };
    const result = customer.id
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setCustomer({ id: "", full_name: "", document_number: "", email: "", phone: "", status: "active", notes: "" });
    setNotice("Cliente salvo no banco Lovable Cloud."); await load();
  }

  async function savePlan(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);
    const down = Number(plan.download_mbps), up = Number(plan.upload_mbps), price = plan.price.trim() ? Number(plan.price) : null;
    if (!Number.isInteger(down) || down < 1 || !Number.isInteger(up) || up < 1 || (price !== null && (!Number.isFinite(price) || price < 0))) {
      setError("Informe velocidades inteiras positivas e um preço válido."); setSaving(false); return;
    }
    const payload = { name: plan.name.trim(), download_mbps: down, upload_mbps: up, price, is_active: plan.is_active };
    const result = plan.id ? await supabase.from("service_plans").update(payload).eq("id", plan.id) : await supabase.from("service_plans").insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setPlan({ id: "", name: "", download_mbps: "300", upload_mbps: "150", price: "", is_active: true });
    setNotice("Plano salvo no banco Lovable Cloud."); await load();
  }

  async function togglePlan(item: Plan) {
    const { error: e } = await supabase.from("service_plans").update({ is_active: !item.is_active }).eq("id", item.id);
    if (e) setError(e.message); else { setNotice(item.is_active ? "Plano desativado." : "Plano ativado."); await load(); }
  }

  const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400";
  const label = "mb-1 block text-xs font-medium text-slate-400";
  return <main className="min-h-screen bg-[#080d17] px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[.18em] text-cyan-300">DM4615 • administração</p><h1 className="mt-1 text-2xl font-semibold">Cadastros</h1><p className="mt-1 text-sm text-slate-400">Clientes e planos de serviço — dados persistidos no Lovable Cloud.</p></div>
        <Link to="/painel" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Voltar ao painel</Link>
      </header>
      <div className="flex gap-2 border-b border-slate-800">
        <button onClick={() => setTab("clientes")} className={`px-4 py-3 text-sm ${tab === "clientes" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}>Clientes ({customers.length})</button>
        <button onClick={() => setTab("planos")} className={`px-4 py-3 text-sm ${tab === "planos" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}>Planos ({plans.length})</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}
      {tab === "clientes" ? <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={saveCustomer} className="h-fit space-y-3 rounded-xl border border-slate-800 bg-[#0c1320] p-5">
          <h2 className="font-semibold">{customer.id ? "Editar cliente" : "Novo cliente"}</h2>
          <div><label className={label}>Nome completo *</label><input className={field} required value={customer.full_name} onChange={e => setCustomer({...customer,full_name:e.target.value})}/></div>
          <div><label className={label}>CPF/CNPJ</label><input className={field} value={customer.document_number} onChange={e => setCustomer({...customer,document_number:e.target.value})}/></div>
          <div><label className={label}>E-mail</label><input type="email" className={field} value={customer.email} onChange={e => setCustomer({...customer,email:e.target.value})}/></div>
          <div><label className={label}>Telefone</label><input className={field} value={customer.phone} onChange={e => setCustomer({...customer,phone:e.target.value})}/></div>
          <div><label className={label}>Situação</label><select className={field} value={customer.status} onChange={e => setCustomer({...customer,status:e.target.value})}><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="suspended">Suspenso</option></select></div>
          <div><label className={label}>Observações</label><textarea className={field} rows={3} value={customer.notes} onChange={e => setCustomer({...customer,notes:e.target.value})}/></div>
          <button disabled={saving} className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Salvando..." : "Salvar cliente"}</button>
          {customer.id && <button type="button" onClick={() => setCustomer({id:"",full_name:"",document_number:"",email:"",phone:"",status:"active",notes:""})} className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancelar edição</button>}
        </form>
        <section className="rounded-xl border border-slate-800 bg-[#0c1320] p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Clientes cadastrados</h2><button onClick={() => void load()} className="text-xs text-cyan-300">Atualizar</button></div>
          {loading ? <p className="text-sm text-slate-400">Carregando...</p> : customers.length === 0 ? <p className="text-sm text-slate-400">Nenhum cliente cadastrado.</p> : <div className="space-y-2">{customers.map(c => <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"><div className="min-w-0"><p className="font-medium">{c.full_name}</p><p className="text-xs text-slate-400">{c.document_number || "Sem documento"} • {c.phone || "Sem telefone"} • {c.email || "Sem e-mail"}</p><p className="text-xs text-slate-500">Situação: {c.status}</p></div><button onClick={() => {setCustomer({id:c.id,full_name:c.full_name,document_number:c.document_number ?? "",email:c.email ?? "",phone:c.phone ?? "",status:c.status,notes:c.notes ?? ""});window.scrollTo({top:0,behavior:"smooth"});}} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs">Editar</button></article>)}</div>}
        </section>
      </div> : <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={savePlan} className="h-fit space-y-3 rounded-xl border border-slate-800 bg-[#0c1320] p-5">
          <h2 className="font-semibold">{plan.id ? "Editar plano" : "Novo plano"}</h2>
          <div><label className={label}>Nome *</label><input className={field} required value={plan.name} onChange={e => setPlan({...plan,name:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={label}>Download (Mbps)</label><input type="number" min="1" step="1" required className={field} value={plan.download_mbps} onChange={e => setPlan({...plan,download_mbps:e.target.value})}/></div><div><label className={label}>Upload (Mbps)</label><input type="number" min="1" step="1" required className={field} value={plan.upload_mbps} onChange={e => setPlan({...plan,upload_mbps:e.target.value})}/></div></div>
          <div><label className={label}>Preço mensal (R$)</label><input type="number" min="0" step="0.01" className={field} value={plan.price} onChange={e => setPlan({...plan,price:e.target.value})}/></div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={plan.is_active} onChange={e => setPlan({...plan,is_active:e.target.checked})}/> Plano ativo</label>
          <button disabled={saving} className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Salvando..." : "Salvar plano"}</button>
          {plan.id && <button type="button" onClick={() => setPlan({id:"",name:"",download_mbps:"300",upload_mbps:"150",price:"",is_active:true})} className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancelar edição</button>}
        </form>
        <section className="rounded-xl border border-slate-800 bg-[#0c1320] p-5"><h2 className="mb-4 font-semibold">Planos cadastrados</h2>
          {loading ? <p className="text-sm text-slate-400">Carregando...</p> : plans.length === 0 ? <p className="text-sm text-slate-400">Nenhum plano cadastrado.</p> : <div className="space-y-2">{plans.map(p => <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"><div><p className="font-medium">{p.name}</p><p className="text-xs text-slate-400">{p.download_mbps}/{p.upload_mbps} Mbps • {p.price == null ? "Preço não informado" : p.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} • {p.is_active ? "Ativo" : "Inativo"}</p></div><div className="flex gap-2"><button onClick={() => setPlan({id:p.id,name:p.name,download_mbps:String(p.download_mbps),upload_mbps:String(p.upload_mbps),price:p.price == null ? "" : String(p.price),is_active:p.is_active})} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs">Editar</button><button onClick={() => void togglePlan(p)} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs">{p.is_active ? "Desativar" : "Ativar"}</button></div></article>)}</div>}
        </section>
      </div>}
      <p className="text-xs text-slate-500">A exclusão física de clientes não é oferecida para preservar vínculos e histórico. Use a situação Inativo/Suspenso.</p>
    </div>
  </main>;
}
