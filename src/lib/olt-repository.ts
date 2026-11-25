import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
export type Olt = Database["public"]["Tables"]["olt_devices"]["Row"];
export const oltSchema = z.object({
  name: z.string().trim().min(2).max(80),
  vendor: z.literal("Datacom"),
  model: z.literal("DM4615"),
  management_host: z
    .string()
    .regex(/^(?:\d{1,3}\.){3}\d{1,3}$/)
    .refine((v) => v.split(".").every((n) => Number(n) <= 255), "IPv4 inválido"),
  management_port: z.number().int().min(1).max(65535),
  ssh_username: z.string().trim().min(1).max(64),
  credential_ref: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/, "Referência do cofre inválida"),
  timeout_seconds: z.number().int().min(3).max(30),
  enabled: z.boolean(),
});
export type OltInput = z.infer<typeof oltSchema>;
export const oltQuery = queryOptions({
  queryKey: ["olt-devices"],
  queryFn: async () => {
    const { data, error } = await supabase.from("olt_devices").select("*").order("created_at");
    if (error) throw new Error(`Não foi possível carregar OLTs: ${error.message}`);
    return data ?? [];
  },
});
export async function saveOlt(input: OltInput, id?: string) {
  const payload = oltSchema.parse(input);
  const result = id
    ? await supabase
        .from("olt_devices")
        .update({ ...payload, ...(!payload.enabled ? { is_selected: false } : {}) })
        .eq("id", z.string().uuid().parse(id))
        .select()
        .single()
    : await supabase.from("olt_devices").insert(payload).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function deleteOlt(id: string) {
  const { error, data } = await supabase
    .from("olt_devices")
    .delete()
    .eq("id", z.string().uuid().parse(id))
    .select("id");
  if (error)
    throw new Error("Exclusão recusada; preserve vínculos e desative a OLT. " + error.message);
  if (!data?.length) throw new Error("OLT não encontrada ou acesso negado.");
}
export async function selectOlt(id: string) {
  const { error } = await supabase.rpc("select_active_olt", {
    _olt_id: z.string().uuid().parse(id),
  });
  if (error) throw new Error(error.message);
}
export async function recordOltTest(
  id: string,
  status: string,
  latency: number | null,
  errorMessage: string | null,
) {
  const { error } = await supabase
    .from("olt_devices")
    .update({
      last_test_at: new Date().toISOString(),
      last_status: status,
      last_latency_ms: latency,
      last_error: errorMessage?.slice(0, 500) ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(`Teste concluído, mas o resultado não foi salvo: ${error.message}`);
}
