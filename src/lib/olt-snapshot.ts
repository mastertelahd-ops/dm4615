// Última coleta MANUAL confirmada no equipamento real. Não é dado ao vivo.
export const MANUAL_SNAPSHOT = {
  source: "Coleta manual confirmada (CLI via SSH)",
  olt: { vendor: "Datacom", model: "DM4615", ip: "192.168.0.25", sshPort: 22 },
  pon: {
    id: "1/1/2",
    adminState: "Enabled",
    operState: "Up",
    type: "GPON",
    fecUpstream: "Enabled",
    fecDownstream: "Enabled",
    transceiver: "taclink-datacom-custom",
    upstreamKbps: { max: 1_399_936, availableCbr: 615_744, total: 1_217_344, overhead: 66 },
  },
  onus: [
    { onuId: 1, serial: "ZTEGC4FFAB0A", status: "Up" as const },
    { onuId: 2, serial: "ZYXE8CAF45DD", status: "Down" as const },
  ],
  validatedCommands: ["show interface gpon 1/1/2", "show interface gpon 1/1/2 onu"],
};
