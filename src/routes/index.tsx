import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "DM4615 | Gestão de OLT" },
      { name: "description", content: "Painel de leitura da OLT Datacom DM4615." },
      { property: "og:title", content: "DM4615 | Gestão de OLT" },
      { property: "og:description", content: "Painel de leitura da OLT Datacom DM4615." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/painel" : "/auth" });
  },
});
