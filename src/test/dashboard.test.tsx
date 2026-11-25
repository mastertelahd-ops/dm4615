import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Route } from "@/routes/_authenticated/painel";

const Page = Route.options.component as () => React.JSX.Element;

describe("dashboard", () => {
  it("sem agente mostra estado desconhecido e modo simulação isolado", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<Page />);
    expect(screen.getByText(/AGENTE DESCONHECIDO/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Modo demonstração/ }));
    expect(screen.getByText("SIMULAÇÃO — NÃO SÃO DADOS DA OLT")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
