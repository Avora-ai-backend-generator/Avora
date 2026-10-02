/** Public requirements-file adapter. No package installation or compiler implementation. */
import type { Diagnostic, NodeManifest } from "./index";
export interface DependencyFile {
  framework: "fastapi";
  path: string;
}
export const dependencyPath = "dependencies/fastapi/requirements.txt";
export const safeDependencyPath = (value: string) => value === dependencyPath;
export type DependencyRow = {
  line: number;
  start: number;
  end: number;
  name: string;
  version: string;
  marker: string;
  comment: string;
  prefix: string;
  metadata?: {
    fields?: Record<string, unknown>;
    bareVersion?: boolean;
    versionPresent?: boolean;
  };
};
export type DependencyEdit = {
  action: "add" | "update" | "remove";
  line?: number;
  name?: string;
  version?: string;
};
const packagePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9._,-]+\])?$/;
const versionsPattern =
  /^(?:(?:===|==|!=|~=|<=|>=|<|>)\s*[A-Za-z0-9.*+!_-]+\s*(?:,\s*(?:===|==|!=|~=|<=|>=|<|>)\s*[A-Za-z0-9.*+!_-]+\s*)*)?$/;
function commentAt(line: string) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    if ((line[i] === '"' || line[i] === "'") && line[i - 1] !== "\\")
      quote = quote === line[i] ? "" : quote || line[i];
    if (!quote && line[i] === "#" && (i === 0 || /\s/.test(line[i - 1])))
      return i;
  }
  return line.length;
}
export function parseDependencies(source: string): {
  rows: DependencyRow[];
  diagnostics: Diagnostic[];
} {
  const rows: DependencyRow[] = [],
    diagnostics: Diagnostic[] = [];
  if (source.length > 2_000_000)
    return {
      rows,
      diagnostics: [
        {
          start: 0,
          end: 1,
          severity: "error",
          code: "dependency.size",
          message: "Dependencies exceed 2 MB.",
        },
      ],
    };
  let start = 0,
    line = 0;
  for (const original of source.split(/\n/)) {
    const text = original.replace(/\r$/, "");
    const end = start + text.length;
    const problem = (message: string) =>
      diagnostics.push({
        start,
        end,
        severity: "error",
        code: "dependency.syntax",
        message,
      });
    if (text.trim() && !text.trimStart().startsWith("#")) {
      const at = commentAt(text),
        requirement = text.slice(0, at).trim(),
        comment = text.slice(at);
      const match = requirement.match(
        /^([A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9._,-]+\])?)\s*([^;]*?)(\s*;.*)?$/,
      );
      if (
        !match ||
        !versionsPattern.test(match[2].trim()) ||
        /[\\@]/.test(requirement)
      ) {
        problem(
          "Use a named PyPI requirement, for example pendulum>=3,<4. This line is preserved; edit it in Source. URLs, includes, installer options and multiline requirements are not supported.",
        );
      } else {
        const row: DependencyRow = {
          line,
          start,
          end,
          name: match[1],
          version: match[2].trim(),
          marker: match[3] || "",
          comment,
          prefix: text.match(/^\s*/)?.[0] || "",
        };
        if (comment.startsWith("# avora:")) {
          try {
            const metadata = JSON.parse(comment.slice(8));
            if (
              !metadata ||
              typeof metadata !== "object" ||
              Array.isArray(metadata) ||
              (metadata.fields &&
                (typeof metadata.fields !== "object" ||
                  Array.isArray(metadata.fields))) ||
              ["name", "version"].some((k) =>
                Object.hasOwn(metadata.fields || {}, k),
              )
            )
              throw new Error();
            row.metadata = metadata;
          } catch {
            problem(
              "Invalid Avora import metadata comment. Fix it in Source; it has not been discarded.",
            );
          }
        }
        rows.push(row);
      }
    }
    start += original.length + 1;
    line++;
  }
  return { rows, diagnostics };
}
export function patchDependencies(
  source: string,
  edit: DependencyEdit,
): string {
  if (!edit || !["add", "update", "remove"].includes(edit.action))
    throw new Error("Invalid dependency edit.");
  const parsed = parseDependencies(source);
  const row = parsed.rows.find((r) => r.line === edit.line);
  if (edit.action !== "add" && !row)
    throw new Error(
      "The dependency changed. Reopen the current table and retry.",
    );
  if (parsed.diagnostics.some((d) => row && d.start === row.start))
    throw new Error("Fix this line in Source first.");
  if (edit.action === "remove") {
    // Keep user comments when removing a declaration. Avora import metadata belongs to that declaration.
    const keep =
      row!.comment && !row!.metadata ? row!.prefix + row!.comment : "";
    return source.slice(0, row!.start) + keep + source.slice(row!.end);
  }
  const name = (edit.name || "").trim(),
    version = (edit.version || "").trim();
  if (!packagePattern.test(name) || !versionsPattern.test(version))
    throw new Error(
      "Enter a package name and a constraint such as >=3,<4 or ==3.1.0.",
    );
  if (edit.action === "add") {
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    return (
      source +
      (source && !source.endsWith("\n") ? eol : "") +
      name +
      version +
      eol
    );
  }
  return (
    source.slice(0, row!.start) +
    row!.prefix +
    name +
    version +
    row!.marker +
    (row!.comment ? "  " + row!.comment : "") +
    source.slice(row!.end)
  );
}
export function dependenciesToDeclarations(
  source: string,
): Record<string, unknown>[] {
  const { rows, diagnostics } = parseDependencies(source);
  if (diagnostics.length)
    throw new Error(`requirements.txt: ${diagnostics[0].message}`);
  return rows.map((row) => {
    let version = row.version;
    if (row.metadata?.bareVersion && /^==[^=*]+$/.test(version))
      version = version.slice(2);
    version += row.marker;
    return {
      ...row.metadata?.fields,
      name: row.name,
      ...(version || row.metadata?.versionPresent ? { version } : {}),
    };
  });
}
export function declarationsToDependencies(
  declarations: Record<string, any>[],
): string {
  const header =
    "# Node libraries. Avora adds the framework runtime automatically.\n# Edit here or use the Dependencies table. Preserve avora comments for import mappings.\n";
  return (
    header +
    declarations
      .map((declaration) => {
        const { name, version, ...fields } = declaration;
        if (
          typeof name !== "string" ||
          (version !== undefined && typeof version !== "string")
        )
          throw new Error("Invalid existing dependency declaration.");
        const bareVersion = typeof version === "string" && /^\d/.test(version);
        const requirement = name + (bareVersion ? "==" : "") + (version || "");
        if (parseDependencies(requirement).diagnostics.length)
          throw new Error(
            `Cannot migrate dependency ${name}. Correct the existing declaration first.`,
          );
        const metadata = {
          fields,
          ...(bareVersion ? { bareVersion: true } : {}),
          ...(version !== undefined ? { versionPresent: true } : {}),
        };
        return (
          requirement +
          (Object.keys(fields).length || version !== undefined
            ? "  # avora: " + JSON.stringify(metadata)
            : "") +
          "\n"
        );
      })
      .join("")
  );
}
/** Pure migration: callers commit new files before replacing the manifest. Legacy readers remain supported. */
export function migrateDependencyFiles(manifest: NodeManifest) {
  const next = structuredClone(manifest),
    files: Record<string, string> = {};
  if (
    !next.payload.code_bundle.fastapi ||
    next.dependencyFiles?.some((f) => f.framework === "fastapi")
  )
    return { manifest: next, files };
  files[dependencyPath] = declarationsToDependencies(
    next.payload.code_bundle.fastapi.dependencies || [],
  );
  delete next.payload.code_bundle.fastapi.dependencies;
  next.dependencyFiles = [
    ...(next.dependencyFiles || []),
    { framework: "fastapi", path: dependencyPath },
  ];
  next.formatVersion = next.formatVersion === 4 ? 4 : 3;
  next.projectId ||= next.draftId;
  return { manifest: next, files };
}
