import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | DM4615" },
      { name: "description", content: "Acesso administrativo ao painel da OLT DM4615." },
    ],
  }),
  component: AuthPage,
});

const GOOGLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>`;

function AuthPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setMsg("Não foi possível iniciar o acesso com Google. Tente novamente.");
      } else if (!result.redirected) {
        navigate({ to: "/painel" });
      }
    } catch {
      setMsg("Falha ao iniciar a autenticação. Confira a configuração do Google no Lovable Cloud.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">DM4615</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Acesso restrito ao administrador autorizado.
        </p>
        <button
          type="button"
          onClick={google}
          disabled={busy}
          style={{ background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #747775" }}
          className="flex w-full items-center justify-center gap-[10px] rounded-md px-3 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: GOOGLE_ICON }} className="flex" />
          {busy ? "Conectando..." : "Entrar com Google"}
        </button>
        {msg && <p role="alert" className="mt-3 text-sm text-destructive">{msg}</p>}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Somente contas cadastradas e ativas como administradoras podem acessar o painel.
        </p>
      </section>
    </main>
  );
}
