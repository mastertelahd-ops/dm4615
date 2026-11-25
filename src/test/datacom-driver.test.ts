import { describe, expect, it } from "vitest";
import {
  LAB_TARGET,
  operationCommand,
  parseOnuTable,
  parseServicePorts,
  parseProfiles,
  evaluatePreflight,
  validateTarget,
} from "../../agent/windows/driver.mjs";

describe("Datacom safety and CLI parsing (mock fixtures, not physical OLT)", () => {
  it("uses 1/1/5 syntax for the validated interface operation", () => {
    expect(operationCommand("gpon.interface", { pon: "1/1/5" })).toBe("show interface gpon 1/1/5");
    expect(() => operationCommand("gpon.interface", { pon: "0/5" })).toThrow();
  });
  it("extracts the laboratory serial from a mock discovered ONU table", () => {
    const result = parseOnuTable(
      "PON Serial Model\n1/1/5 ZYXE8CB7A0F6 PX3321-T1\nFireNet-OLT#",
      true,
    );
    expect(result.items[0]?.serial).toBe("ZYXE8CB7A0F6");
    expect(result.items[0]?.pon).toBe("1/1/5");
    expect(result.items[0]?.onuId).toBeNull();
    expect(result.complete).toBe(true);
  });
  it("does not accept truncated inventory as complete", () => {
    expect(parseOnuTable("PON Serial\n1/1/5 ZYXE8CB7A0F6", true).complete).toBe(false);
  });
  it("rejects operations targeting existing customers in PON 1/1/2", () => {
    expect(() => validateTarget({ ...LAB_TARGET, pon: "1/1/2", mode: "bridge" })).toThrow();
  });
  it("requires the initial ONU-ID 1, 650 Mbps, VLAN 3203 and GEM 1", () => {
    expect(validateTarget({ ...LAB_TARGET, mode: "bridge" })).toEqual({
      ...LAB_TARGET,
      mode: "bridge",
    });
    for (const changed of [{ onuId: 2 }, { downloadMbps: 300 }, { vlan: 1 }, { gem: 2 }]) {
      expect(() => validateTarget({ ...LAB_TARGET, ...changed, mode: "bridge" })).toThrow();
    }
  });
  it("never reuses service-ports 1 and 2", () => {
    const result = evaluatePreflight(
      { ...LAB_TARGET, mode: "bridge" },
      { servicePorts: parseServicePorts("no service-ports\nFireNet-OLT#") },
    );
    expect(result.servicePortId).toBe(3);
  });
  it("does not treat LINE-650M Ethernet as VEIP", () => {
    const profiles = parseProfiles(
      "profile gpon\n line-profile LINE-650M\n tcont 1 bandwidth-profile PLANO-650M\n gem 1\n map ethernet 1 vlan 3203 cos any\nFireNet-OLT#",
    );
    expect(profiles.items[0]?.mapping).toBe("ethernet");
    const result = evaluatePreflight({ ...LAB_TARGET, mode: "router" }, { profiles });
    expect(result.checks.find((c) => c.name === "Perfil e mapeamento")?.ok).toBe(false);
    expect(result.executionEnabled).toBe(false);
    expect(result.commands).toEqual([]);
  });
});
