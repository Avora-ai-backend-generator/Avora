/** Portable source contracts. Available before building the SDK runtime. */
export interface NodeScenario {
  formatVersion: 1;
  id: string;
  label?: string;
  framework: string;
  variantId: string;
  context: string;
  configuration: {
    lineValues: Record<string, string | string[]>;
    deletedLineIds?: string[];
    [key: string]: unknown;
  };
  inputs: Record<string, unknown>;
  expect?: { output?: unknown; error?: { status: number; body?: unknown } };
  generatedCase?: {version: 1; key: string; baselineHash: string};
  [key: string]: unknown;
}

export interface WorkspaceContext {
  formatVersion: 1;
  id: string;
  graph: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
  settings: Record<string, unknown>;
  caseFixtures?: {
    fields?: Record<string,string|string[]>;
    inputs?: Record<string,unknown>;
    types?: Record<string,unknown>;
  };
  [key: string]: unknown;
}

export type ScenarioChanges = Partial<
  Pick<NodeScenario, "label" | "variantId" | "framework" | "context" | "configuration" | "inputs" | "expect">
>;
