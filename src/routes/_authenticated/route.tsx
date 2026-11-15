import { AgentProvider } from "@/lib/agent-context";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Authentication alone is not authorization: require an active admin profile.
    const { data: profile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("role, is_active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin" || !profile.is_active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: Layout,
});

function Layout() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AgentProvider>
    <>
      <button
        onClick={signOut}
        className="fixed right-4 top-3 z-50 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        Sair
      </button>
      <Outlet />
    </>
    </AgentProvider>
  );
}
