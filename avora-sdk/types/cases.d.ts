import type { NodeScenario } from "./scenario";

export interface CaseProposal {
  path: string;
  label: string;
  status: "add" | "update" | "unchanged" | "review" | "obsolete";
  warnings: string[];
  conflicts: string[];
  /** Review content, never accepted execution results. */
  proposed?: NodeScenario;
}
export interface CasePreview {
  context: string;
  budget: number;
  entries: CaseProposal[];
  warnings: string[];
}
