// Pure DmOS logic shared by the browser and the local agent; no SSH or browser globals.
export const LAB_TARGET = Object.freeze({
  serial: "ZYXE8CB7A0F6",
  pon: "1/1/5",
  onuId: 1,
  downloadMbps: 650,
  vlan: 3203,
  gem: 1,
  profile: "LINE-650M",
});
export const OPERATIONS = Object.freeze({
  "gpon.brief": "show interface gpon brief",
  "onu.discovered": "show interface gpon discovered-onus",
  "onu.provisioned": "show interface gpon onu",
  "profiles.list": "show running-config profile gpon",
  "servicePorts.list": "show running-config service-port",
  "vlans.config": "show running-config service vlan",
  "vlans.list": "show vlan brief",
  "vlans.membership": "show vlan membership brief",
});
export function validPon(pon) {
  return typeof pon === "string" && /^1\/1\/(?:[1-9]|1[0-6])$/.test(pon);
}
export function operationCommand(operation, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("Parâmetros inválidos.");
  const allowedKeys =
    operation === "gpon.interface" || operation === "gpon.config" || operation === "onu.pon"
      ? ["pon"]
      : operation === "profiles.line"
        ? ["profile"]
        : [];
  if (Object.keys(args).some((k) => !allowedKeys.includes(k)))
    throw new Error("Parâmetro não permitido.");
  if (operation === "gpon.interface" || operation === "gpon.config" || operation === "onu.pon") {
    if (!validPon(args.pon)) throw new Error("PON deve estar entre 1/1/1 e 1/1/16.");
    return operation === "gpon.interface"
      ? `show interface gpon ${args.pon}`
      : operation === "gpon.config"
        ? `show running-config interface gpon ${args.pon}`
        : `show interface gpon ${args.pon} onu`;
  }
  if (operation === "profiles.line") {
    if (args.profile !== LAB_TARGET.profile) throw new Error("Perfil de laboratório não validado.");
    return `show running-config profile gpon line-profile ${args.profile}`;
  }
  if (!Object.hasOwn(OPERATIONS, operation)) throw new Error("Operação não permitida.");
  return OPERATIONS[operation];
}
export function cleanCli(raw) {
  return String(raw)
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[^\x20-\x7e\n\r\t]/g, "")
    .replace(/--\s*More\s*--/gi, "")
    .replace(/\r/g, "");
}
export function redact(raw) {
  return cleanCli(raw).replace(
    /\b(password|secret|community|token|passphrase)\s+(?:\S+\s+)?\S+/gi,
    "$1 [REDACTED]",
  );
}
function envelope(raw, items, recognized, warnings = []) {
  const text = cleanCli(raw);
  const complete =
    /FireNet-OLT#\s*$/.test(text) &&
    !/(?:%\s*(?:error|invalid)|syntax error|unknown command|incomplete command|command not found)/i.test(
      text,
    ) &&
    recognized &&
    !warnings.length;
  return { items, complete, parseStatus: complete ? "ok" : "unrecognized-or-incomplete", warnings };
}
export function parseOnuTable(raw, discovered = false) {
  const text = cleanCli(raw);
  const items = [];
  const warnings = [];
  for (const line of text.split("\n")) {
    if (!/^\s*1\/1\/\d+\s+/.test(line)) continue;
    const columns = line.trim().split(/\s+/);
    const pon = columns.shift();
    if (!validPon(pon)) {
      warnings.push("PON fora do contrato.");
      continue;
    }
    const serialIndex = columns.findIndex((c) => /^[A-Z]{4}[0-9A-F]{8}$/.test(c));
    const serial = columns[serialIndex];
    if (serialIndex < 0 || !serial) {
      warnings.push("Linha de ONU não interpretada.");
      continue;
    }
    const id = serialIndex > 0 && /^\d+$/.test(columns[0] ?? "") ? Number(columns[0]) : null;
    if (!discovered && (id === null || id < 1 || id > 128)) {
      warnings.push("ONU-ID ausente ou inválido.");
      continue;
    }
    const state = columns.find((c) => /^(Up|Down|Online|Offline)$/i.test(c)) ?? null;
    items.push({
      pon,
      onuId: id,
      serial,
      state,
      model: columns.find((c) => /^PX3321-T1$/i.test(c)) ?? null,
      discovered,
    });
  }
  return envelope(text, items, /(?:serial|discovered.onus|no onus|0 onus)/i.test(text), warnings);
}
export function parseBrief(raw) {
  const items = [];
  const warnings = [];
  for (const line of cleanCli(raw).split("\n")) {
    if (!/^\s*1\/1\/\d+\s+/.test(line)) continue;
    const m = line.match(/^\s*(1\/1\/\d+)\s+(Enabled|Disabled)\s+(Up|Down)\b/i);
    if (!m || !validPon(m[1])) {
      warnings.push("Linha GPON não interpretada.");
      continue;
    }
    items.push({ pon: m[1], adminState: m[2], operState: m[3] });
  }
  return envelope(raw, items, /(?:admin|oper|interface|gpon)/i.test(raw), warnings);
}
export function parseProfiles(raw) {
  const text = cleanCli(raw);
  const items = [];
  const blocks = [...text.matchAll(/^\s*line-profile\s+([A-Za-z0-9_-]+)\s*$/gm)];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;
    const config = text.slice(block.index, blocks[i + 1]?.index ?? text.length);
    const mapping = /\bmap\s+ethernet\s+1\s+vlan\s+(\d+)\s+cos\s+any\b/i.exec(config);
    const veip = /\bmap\s+veip\b/i.test(config);
    const tcont = /\btcont\s+(\d+)\s+(?:bandwidth-profile\s+)?([A-Za-z0-9_-]+)/i.exec(config);
    const gem = /\bgem\s+(\d+)\b/i.exec(config);
    items.push({
      name: block[1],
      mapping: veip ? "veip" : mapping ? "ethernet" : "unknown",
      vlan: mapping ? Number(mapping[1]) : null,
      gem: gem ? Number(gem[1]) : null,
      tcont: tcont ? Number(tcont[1]) : null,
      bandwidthProfile: tcont?.[2] ?? null,
    });
  }
  return envelope(text, items, /(?:profile gpon|line-profile|no profiles)/i.test(text));
}
export function parseServicePorts(raw) {
  const text = cleanCli(raw);
  const items = [];
  const warnings = [];
  const blocks = [...text.matchAll(/^\s*service-port\s+(\d+)\b/gm)];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;
    const config = text.slice(block.index, blocks[i + 1]?.index ?? text.length);
    const pon = /\bgpon\s+(1\/1\/\d+)/i.exec(config)?.[1] ?? null;
    const onu = /\bonu\s+(\d+)/i.exec(config);
    const gem = /\bgem\s+(\d+)/i.exec(config);
    const vlan = /\bvlan\s+(\d+)/i.exec(config);
    if (!pon || !validPon(pon) || !onu || !gem || !vlan)
      warnings.push(`Service-port ${block[1]} não interpretado completamente.`);
    items.push({
      id: Number(block[1]),
      pon,
      onuId: onu ? Number(onu[1]) : null,
      gem: gem ? Number(gem[1]) : null,
      vlan: vlan ? Number(vlan[1]) : null,
    });
  }
  return envelope(text, items, /(?:service-port|no service.ports)/i.test(text), warnings);
}
export function parseVlans(raw) {
  const text = cleanCli(raw);
  const items = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:vlan\s+)?(\d{1,4})\s+([^\n]*)$/i);
    if (!m) continue;
    const id = Number(m[1]);
    if (id < 1 || id > 4094 || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, details: m[2].trim() });
  }
  return envelope(text, items, /vlan/i.test(text));
}
export function parseOperation(operation, raw) {
  if (operation === "gpon.brief") return parseBrief(raw);
  if (operation === "onu.discovered") return parseOnuTable(raw, true);
  if (operation === "onu.provisioned" || operation === "onu.pon") return parseOnuTable(raw);
  if (operation === "profiles.list" || operation === "profiles.line") return parseProfiles(raw);
  if (operation === "servicePorts.list") return parseServicePorts(raw);
  if (operation.startsWith("vlans.")) return parseVlans(raw);
  return envelope(raw, [], false, ["Saída disponível somente para inspeção bruta."]);
}
export function validateTarget(input) {
  if (!input || typeof input !== "object") throw new Error("Alvo inválido.");
  for (const [key, value] of Object.entries(LAB_TARGET))
    if (input[key] !== value) throw new Error(`Alvo bloqueado: ${key} deve ser ${value}.`);
  if (input.mode !== "bridge" && input.mode !== "router") throw new Error("Modo inválido.");
  if (Object.keys(input).some((k) => !Object.hasOwn(LAB_TARGET, k) && k !== "mode"))
    throw new Error("Parâmetros extras bloqueados.");
  return { ...LAB_TARGET, mode: input.mode };
}
export function evaluatePreflight(input, evidence) {
  const target = validateTarget(input);
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok, detail });
  const complete = ["discovered", "provisioned", "profiles", "servicePorts", "vlans"].every(
    (k) => evidence[k]?.complete === true,
  );
  check(
    "Inventário completo",
    complete,
    complete
      ? "Saídas completas e interpretadas."
      : "Há saída desconhecida, incompleta ou coleta ausente.",
  );
  const discovered = evidence.discovered?.items ?? [];
  const provisioned = evidence.provisioned?.items ?? [];
  check(
    "Serial e PON",
    discovered.some((o) => o.serial === target.serial && o.pon === target.pon),
    "A descoberta atual deve confirmar ZYXE8CB7A0F6 em 1/1/5.",
  );
  check(
    "ONU ainda não cadastrada",
    !provisioned.some((o) => o.serial === target.serial),
    "Serial não pode existir no inventário cadastrado.",
  );
  check(
    "ONU-ID livre",
    complete && !provisioned.some((o) => o.pon === target.pon && o.onuId === 1),
    "ONU-ID 1 reservado somente se comprovadamente livre na PON 1/1/5.",
  );
  const profile = evidence.profiles?.items?.find((p) => p.name === target.profile);
  check(
    "Perfil e mapeamento",
    !!profile &&
      profile.gem === 1 &&
      profile.tcont === 1 &&
      profile.bandwidthProfile === "PLANO-650M" &&
      (target.mode === "bridge"
        ? profile.mapping === "ethernet" && profile.vlan === 3203
        : profile.mapping === "veip"),
    target.mode === "router"
      ? "LINE-650M Ethernet não comprova Router/VEIP."
      : "Exige Ethernet 1, VLAN 3203, GEM 1, T-CONT 1 / PLANO-650M.",
  );
  check(
    "VLAN existente",
    evidence.vlans?.complete === true && evidence.vlans.items.some((v) => v.id === 3203),
    "VLAN 3203 deve existir; nenhuma VLAN será criada.",
  );
  const used = new Set((evidence.servicePorts?.items ?? []).map((s) => s.id));
  // Never reuse the known customer service-ports, even if a parser omits them.
  used.add(1);
  used.add(2);
  let servicePortId = null;
  if (evidence.servicePorts?.complete)
    for (let n = 3; n <= 4095; n++)
      if (!used.has(n)) {
        servicePortId = n;
        break;
      }
  check(
    "Service-port livre",
    servicePortId !== null,
    servicePortId
      ? `Candidato ${servicePortId}; exige nova leitura imediatamente antes da execução.`
      : "Não foi possível comprovar um ID livre.",
  );
  check(
    "Compatibilidade da Zyxel",
    false,
    target.mode === "router"
      ? "VEIP da PX3321-T1 não comprovado. Avalie Bridge Ethernet após comprovação local."
      : "Mapeamento Ethernet do perfil não comprova suporte do hardware/firmware PX3321-T1.",
  );
  check(
    "Candidate e execução",
    false,
    "CLI de candidate, diff, transação, confirmação e rollback ainda não validada; nenhum comando de escrita será gerado.",
  );
  return {
    target,
    checks,
    servicePortId,
    executionEnabled: false,
    commands: [],
    steps: [
      "Coletar evidências atuais",
      "Validar alvo e IDs",
      "Comprovar modelo/perfil",
      "Inspecionar candidate e pendências globais",
      "Confirmar somente alteração individual",
      "Executar e verificar por leitura",
      "Rollback somente se diff comprovar propriedade exclusiva",
    ],
    bridgeCandidate: !!profile && profile.mapping === "ethernet",
    message: "Dry-run de pré-validação; nenhuma escrita, commit ou rollback foi executado.",
  };
}
