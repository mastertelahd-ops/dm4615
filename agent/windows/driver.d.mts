export type Operation =
  | "gpon.brief"
  | "gpon.interface"
  | "gpon.config"
  | "onu.pon"
  | "onu.discovered"
  | "onu.provisioned"
  | "profiles.list"
  | "profiles.line"
  | "servicePorts.list"
  | "vlans.config"
  | "vlans.list"
  | "vlans.membership";
export type OperationArgs = { pon?: string; profile?: string };
export interface Parsed<T = Record<string, unknown>> {
  items: T[];
  complete: boolean;
  parseStatus: string;
  warnings: string[];
}
export interface DriverOnu {
  pon: string;
  onuId: number | null;
  serial: string;
  state: string | null;
  model: string | null;
  discovered: boolean;
}
export interface DriverProfile {
  name: string;
  mapping: "veip" | "ethernet" | "unknown";
  vlan: number | null;
  gem: number | null;
  tcont: number | null;
  bandwidthProfile: string | null;
}
export interface DriverServicePort {
  id: number;
  pon: string | null;
  onuId: number | null;
  gem: number | null;
  vlan: number | null;
}
export interface DriverVlan {
  id: number;
  details: string;
}
export interface Target {
  serial: string;
  pon: string;
  onuId: number;
  downloadMbps: number;
  vlan: number;
  gem: number;
  profile: string;
  mode: "bridge" | "router";
}
export interface Evidence {
  discovered?: Parsed<DriverOnu>;
  provisioned?: Parsed<DriverOnu>;
  profiles?: Parsed<DriverProfile>;
  servicePorts?: Parsed<DriverServicePort>;
  vlans?: Parsed<DriverVlan>;
}
export interface Preflight {
  target: Target;
  checks: { name: string; ok: boolean; detail: string }[];
  servicePortId: number | null;
  executionEnabled: false;
  commands: never[];
  steps: string[];
  bridgeCandidate: boolean;
  message: string;
}
export const LAB_TARGET: Omit<Target, "mode">;
export const OPERATIONS: Readonly<Record<string, string>>;
export function validPon(pon: unknown): boolean;
export function operationCommand(operation: Operation, args?: OperationArgs): string;
export function cleanCli(raw: string): string;
export function redact(raw: string): string;
export function parseOnuTable(raw: string, discovered?: boolean): Parsed<DriverOnu>;
export function parseBrief(
  raw: string,
): Parsed<{ pon: string; adminState: string; operState: string }>;
export function parseProfiles(raw: string): Parsed<DriverProfile>;
export function parseServicePorts(raw: string): Parsed<DriverServicePort>;
export function parseVlans(raw: string): Parsed<DriverVlan>;
export function parseOperation(operation: Operation, raw: string): Parsed<unknown>;
export function validateTarget(input: unknown): Target;
export function evaluatePreflight(input: Target, evidence: Evidence): Preflight;
