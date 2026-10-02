import type { SourceDiagnostic } from "./diagnostics";
/** Portable result contract shared by CLI, Try Node and Test Explorer. */
export type NodeTestStatus = "passed" | "failed" | "not_tested" | "outdated";
export type NodeTestPhase =
  | "check"
  | "prepare"
  | "start"
  | "ready"
  | "request"
  | "assertions"
  | "complete"
  | "cancelled";
export interface NodeAssertion {
  label: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}
export interface NodeTestReport {
  formatVersion: 1;
  id: string;
  casePath: string;
  label?: string;
  status: NodeTestStatus;
  phase: NodeTestPhase;
  message: string;
  startedAt: string;
  durationMs: number;
  assertions: NodeAssertion[];
  diagnostics?: SourceDiagnostic[];
  actual?: { status: number; body: unknown };
  fingerprint?: string;
  generationId?: string;
  environmentId?: string;
  lockFingerprint?: string;
  identity?: {
    sourceFingerprint: string;
    scenarioFingerprint: string;
    contextFingerprint: string;
    compilerVersion: string;
    dependencyFingerprint: string;
    runtimeProfileId: string;
    privateConfigurationFingerprint: string;
  };
}
export interface NodeTestState {
  status: NodeTestStatus;
  active?: boolean;
  message?: string;
  report?: NodeTestReport;
}
