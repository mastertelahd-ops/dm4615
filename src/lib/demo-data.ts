// MODO DEMONSTRAÇÃO: dados fictícios, isolados do modo real.
// Este módulo não importa nada do agente e nunca é misturado com coletas reais.
export const DEMO_LABEL = "SIMULAÇÃO — NÃO SÃO DADOS DA OLT";

export const DEMO_DATA = {
  simulated: true as const,
  label: DEMO_LABEL,
  agent: { status: "ok (simulado)", version: "0.0.0-demo", latencyMs: 4 },
  pons: [
    { id: "1/1/1", state: "Up", onus: 12 },
    { id: "1/1/2", state: "Up", onus: 8 },
    { id: "1/1/3", state: "Down", onus: 0 },
  ],
  onus: [
    { onuId: 1, serial: "DEMO00000001", status: "Up", rxDbm: -19.4 },
    { onuId: 2, serial: "DEMO00000002", status: "Up", rxDbm: -22.1 },
    { onuId: 3, serial: "DEMO00000003", status: "Down", rxDbm: null },
  ],
  raw: "# SIMULAÇÃO — NÃO SÃO DADOS DA OLT\nInterface gpon 1/1/2 (demo)\n  Admin: Enabled  Oper: Up\n",
};
