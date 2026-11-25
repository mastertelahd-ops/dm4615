import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Route } from "@/routes/_authenticated/painel";
import { AgentProvider } from "@/lib/agent-context";

const Page = Route.options.component as () => React.JSX.Element;

describe("dashboard", () => {
  it("sem agente mostra estado desconhecido e modo simulação isolado", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <AgentProvider>
        <Page />
      </AgentProvider>,
    );
    expect(screen.getByText(/AGENTE DESCONHECIDO/)).toBeInTheDocument();
    expect(screen.getAllByText("1/1/16").length).toBeGreaterThan(0);
    expect(screen.queryByText("ZTEGC4FFAB0A")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Modo demonstração/ }));
    expect(screen.getByText("SIMULAÇÃO — NÃO SÃO DADOS DA OLT")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
