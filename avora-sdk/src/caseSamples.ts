/** Bounded starter sampling from public visual rules. This is not a compiler. */
import type { NodeManifest } from "./index";
import type {
  ConfigField,
  ConfigLine,
  ConfigVariant,
  ConditionGroup,
  SubCondition,
  SelectOption,
} from "../types/structure";
import type { NodeScenario, WorkspaceContext } from "../types/scenario";
import {
  buildInitialLineValues,
  resolveFieldDefaultValue,
} from "./structureDefaults";
import { resolveNodeStructure } from "./structureResolution";
import { evaluateConditionGroup } from "./structureConditions";
import { generationHash } from "./generation";
const hash = (value: unknown) => generationHash(value ?? null);

type Values = Record<string, string | string[]>;
type State = { values: Values; deleted: string[] };
export interface CaseSample {
  path: string;
  key: string;
  scenario: NodeScenario;
  warnings: string[];
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const own = (o: object, k: string) => Object.hasOwn(o, k);
const targetKey = (...parts: unknown[]) => JSON.stringify(parts);
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] || "" : v || "";
export const caseSlug = (id: string) =>
  /^[a-z0-9_-]{1,48}$/.test(id)
    ? id
    : (id
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .slice(0, 35) || "variant") +
      "-" +
      hash(id).slice(0, 10);

/** Unknown/entity types deliberately have no fabricated value. */
function sampleValue(
  type: string,
  types: Record<string, unknown>,
  depth = 0,
): { value: unknown; known: boolean } {
  if (depth > 8) return { value: null, known: false };
  if (own(types, type)) return { value: clone(types[type]), known: true };
  const array =
    type.match(/^\[(.*)\]$/) ||
    type.match(/^(.*)\[\]$/) ||
    type.match(/^(?:list|array)<(.*)>$/i);
  if (array) {
    const result = sampleValue(array[1], types, depth + 1);
    return { ...result, value: result.known ? [result.value] : [] };
  }
  switch (type.toLowerCase()) {
    case "str":
    case "string":
    case "text":
      return { value: "sample", known: true };
    case "int":
    case "integer":
    case "float":
    case "double":
    case "decimal":
    case "number":
    case "long":
      return { value: 1, known: true };
    case "bool":
    case "boolean":
      return { value: true, known: true };
    case "date":
      return { value: "2026-01-01", known: true };
    case "datetime":
    case "timestamp":
      return { value: "2026-01-01T00:00:00Z", known: true };
    case "uuid":
      return { value: "00000000-0000-4000-8000-000000000001", known: true };
    case "json":
    case "dict":
      return { value: {}, known: true };
    default:
      return { value: null, known: false };
  }
}
function selected(field: ConfigField, values: Values): SelectOption[] {
  if (field.kind !== "select") return [];
  const v = values[field.id] ?? field.defaultValue;
  return (field.options || []).filter((o) =>
    (Array.isArray(v) ? v : [v]).includes(o.value),
  );
}
/** Same option field additions, hiding and sibling overrides as ConfigLineRenderer. */
function visibleFields(line: ConfigLine, values: Values): ConfigField[] {
  const options = line.fields.flatMap((f) => selected(f, values));
  const hidden = new Set(options.flatMap((o) => o.hideFields || []));
  const fields = [...line.fields, ...options.flatMap((o) => o.addFields || [])];
  return fields
    .filter((f) => !hidden.has(f.id))
    .map((f) =>
      options.reduce<ConfigField>(
        (field, option) =>
          ({
            ...field,
            ...option.overrideFields?.[f.id],
            id: f.id,
          }) as ConfigField,
        f,
      ),
    );
}
function validateComplexity(value: unknown, depth = 0, count = { n: 0 }) {
  if (++count.n > 30000 || depth > 35)
    throw new Error(
      "Structure or fixtures exceed starter sampling limits. Simplify the input first.",
    );
  if (value && typeof value === "object")
    for (const v of Object.values(value))
      validateComplexity(v, depth + 1, count);
}

function variantSamples(
  sourceVariant: ConfigVariant,
  framework: string,
  contextPath: string,
  context: WorkspaceContext,
  capacity: number,
  outputSize: { bytes: number },
) {
  const variant = {
    ...sourceVariant,
    lines: (sourceVariant.lines || []).map((line) => ({
      ...line,
      fields: line.fields || [],
      instances: line.instances?.map((instance) => ({
        ...instance,
        fields: instance.fields || [],
      })),
    })),
  };
  const fixtures = (context.caseFixtures || {}) as {
    fields?: Values;
    inputs?: Record<string, unknown>;
    types?: Record<string, unknown>;
  };
  for (const value of [
    fixtures,
    fixtures.fields,
    fixtures.inputs,
    fixtures.types,
  ])
    if (
      value !== undefined &&
      (!value || typeof value !== "object" || Array.isArray(value))
    )
      throw new Error(
        "caseFixtures and its fields, inputs and types must be objects.",
      );
  const warnings = new Set<string>();
  const fieldFixtures = fixtures.fields || {},
    inputFixtures = fixtures.inputs || {},
    types: Record<string, unknown> = Object.fromEntries(
      context.graph.nodes
        .filter((n) => n.type === "enumNode" || n.type === "enum")
        .flatMap((n) => {
          const data = n.data as { label?: string; values?: unknown[] };
          return data?.label && data.values?.length
            ? [[data.label, String(data.values[0])]]
            : [];
        }),
    );
  Object.assign(types, fixtures.types || {});
  for (const v of Object.values(fieldFixtures))
    if (
      typeof v !== "string" &&
      !(Array.isArray(v) && v.every((x) => typeof x === "string"))
    )
      throw new Error(
        "caseFixtures.fields values must be strings or string arrays.",
      );
  const base: State = {
    values: { ...buildInitialLineValues(variant), ...fieldFixtures },
    deleted: variant.lines
      .filter(
        (l) => l.lineType === "optional" || l.lineType === "optional-multiple",
      )
      .map((l) => l.id),
  };
  // Repeat counts are bounded independently of case count, including supplied defaults.
  for (const line of variant.lines)
    if (line.lineType === "optional-multiple")
      base.values[`${line.id}_count`] = "1";
  const fieldMap = new Map(
    variant.lines.flatMap((l) => l.fields.map((f) => [f.id, f] as const)),
  );
  const resolve = (state: State) =>
    resolveNodeStructure(variant, state.values, state.deleted);
  const rowValues = (line: ConfigLine, state: State, index = 0) => {
    const local = { ...state.values };
    if (line.lineType === "optional-multiple")
      for (const f of line.fields)
        local[f.id] = state.values[`${f.id}_${index}`] ?? state.values[f.id];
    return local;
  };
  const fill = (state: State) => {
    state = clone(state);
    for (let pass = 0; pass < 5; pass++) {
      const before = hash(state.values);
      for (const line of resolve(state).resolvedLines) {
        if (line.lineType === "generic-object")
          warnings.add(
            `Line ${line.id} uses entity attributes; supply workspace context and review its fields.`,
          );
        const count =
          line.lineType === "optional-multiple"
            ? Math.min(
                2,
                line.max || 2,
                Number(first(state.values[`${line.id}_count`])) || 1,
              )
            : 1;
        for (let i = 0; i < count; i++) {
          const local = rowValues(line, state, i);
          for (const f of visibleFields(line, local)) {
            if (f.kind === "text") continue;
            const id =
              line.lineType === "optional-multiple" ? `${f.id}_${i}` : f.id;
            if (own(state.values, id) && first(state.values[id]) !== "")
              continue;
            const fallback = resolveFieldDefaultValue(
              f,
              (other) => state.values[other],
            );
            if (own(fieldFixtures, id)) state.values[id] = fieldFixtures[id];
            else if (first(fallback)) state.values[id] = fallback!;
            else if (f.kind === "select") {
              if (!f.source || f.source === "static")
                state.values[id] = f.multiSelect
                  ? f.options?.[0]
                    ? [f.options[0].value]
                    : []
                  : f.options?.[0]?.value || "";
              else {
                state.values[id] = "";
                warnings.add(
                  `Field ${f.id} needs a context selection (caseFixtures.fields).`,
                );
              }
            } else
              state.values[id] = String(
                sampleValue(f.fieldType, types).value ?? "",
              );
          }
        }
      }
      if (hash(state.values) === before) break;
    }
    return state;
  };
  const compatible = (state: State) =>
    resolve(state).resolvedLines.every((line) =>
      visibleFields(line, rowValues(line, state)).every((f) => {
        if (
          f.kind !== "select" ||
          f.canCustom ||
          (f.source && f.source !== "static")
        )
          return true;
        const value = rowValues(line, state)[f.id];
        return (
          !first(value) ||
          (Array.isArray(value) ? value : [value]).every((v) =>
            (f.options || []).some((o) => o.value === v),
          )
        );
      }),
    );
  const results: CaseSample[] = [],
    seenStates = new Set<string>(),
    targets = new Set<string>();
  const queue: { state: State; key: string; label: string }[] = [
    { state: base, key: "baseline", label: "Baseline" },
  ];
  let attempts = 0,
    clipped = false;
  const enqueue = (state: State, key: string, label: string) => {
    if (targets.has(key)) return;
    if (queue.length >= 500 || targets.size >= 2000) {
      clipped = true;
      return;
    }
    targets.add(key);
    queue.push({ state, key, label });
  };
  // Bounded witnesses make AND conditions reachable without a full Cartesian product.
  function witnesses(
    condition: ConditionGroup | SubCondition,
    state: State,
    depth = 0,
  ): Values[] {
    if (depth > 12) {
      clipped = true;
      return [];
    }
    if (condition.type === "group") {
      const parts = condition.conditions.map((c) =>
        witnesses(c, state, depth + 1),
      );
      if (condition.logicalOperator === "OR") return parts.flat().slice(0, 16);
      let combined: Values[] = [{}];
      for (const part of parts) {
        const next: Values[] = [];
        for (const a of combined)
          for (const b of part) {
            if (
              Object.keys(b).every(
                (k) => !own(a, k) || hash(a[k]) === hash(b[k]),
              )
            )
              next.push({ ...a, ...b });
            if (next.length >= 16) break;
          }
        combined = next.slice(0, 16);
      }
      return combined;
    }
    if (condition.target.type === "line" && condition.target.lineId) {
      let visible: boolean;
      if (condition.operator === "isAppearing") visible = true;
      else if (condition.operator === "isNotAppearing") visible = false;
      else if (
        condition.operator === "equals" &&
        ["true", "false"].includes(first(condition.value))
      )
        visible = first(condition.value) === "true";
      else if (
        condition.operator === "notEquals" &&
        ["true", "false"].includes(first(condition.value))
      )
        visible = first(condition.value) !== "true";
      else return [];
      return [
        { [targetKey("line", condition.target.lineId)]: String(visible) },
      ];
    }
    const id = condition.target.fieldId;
    if (condition.target.type !== "field" || !id) return [];
    const f = fieldMap.get(id),
      raw =
        condition.valueSource === "field"
          ? state.values[condition.valueFieldId || ""] || ""
          : condition.value;
    const text = first(raw),
      numeric = Number(text);
    let choices: (string | string[])[];
    switch (condition.operator) {
      case "equals":
      case "contains":
        choices = [raw];
        break;
      case "isIn":
        choices = Array.isArray(raw) ? raw.slice(0, 16) : [raw];
        break;
      case "isEmpty":
        choices = [""];
        break;
      case "notEquals":
        choices =
          f?.kind === "select"
            ? (f.options || [])
                .filter((o) => o.value !== text)
                .slice(0, 16)
                .map((o) => o.value)
            : [text === "sample" ? "other" : "sample"];
        break;
      case "isNotEmpty":
        choices = [
          f?.kind === "select" ? f.options?.[0]?.value || "sample" : "sample",
        ];
        break;
      case "greaterThan":
        choices = [String(numeric + 1)];
        break;
      case "lessThan":
        choices = [String(numeric - 1)];
        break;
      case "greaterThanOrEqual":
      case "lessThanOrEqual":
        choices = [String(numeric)];
        break;
      default:
        return [];
    }
    return choices.map((value) => ({
      [targetKey("field", id)]:
        f?.kind === "select" && f.multiSelect && !Array.isArray(value)
          ? [value].filter(Boolean)
          : value,
    }));
  }
  while (queue.length && results.length < capacity && attempts++ < 500) {
    const item = queue.shift()!;
    let state = fill(item.state);
    // Explicit witness emptiness must survive default/sample filling.
    for (const [k, v] of Object.entries(item.state.values))
      if (v === "" && item.key !== "baseline") state.values[k] = v;
    if (!compatible(state)) {
      if (item.key === "baseline")
        throw new Error(
          `Variant ${variant.id} has a default or fixture outside its allowed options. Correct it before generating cases.`,
        );
      continue;
    }
    const resolved = resolve(state),
      signature = hash(state);
    if (seenStates.has(signature)) continue;
    seenStates.add(signature);
    const caseWarnings = new Set(warnings),
      inputs: Record<string, unknown> = Object.create(null);
    for (const input of resolved.elements.inputs.defaults) {
      if (!input.key || input.isEnabled === false) continue;
      if (own(inputFixtures, input.key))
        inputs[input.key] = clone(inputFixtures[input.key]);
      else {
        const sample = sampleValue(input.type || "", types);
        inputs[input.key] = sample.value;
        if (!sample.known)
          caseWarnings.add(
            `Input ${input.key} (${input.type || "unknown type"}) needs a fixture or manual value.`,
          );
      }
    }
    if (Object.values(state.values).some((v) => first(v).includes("{{ENV}}")))
      caseWarnings.add(
        "Environment bindings need matching values in .env.local.",
      );
    const key = targetKey(framework, variant.id, contextPath, item.key);
    results.push({
      key,
      path: `tests/cases/${caseSlug(variant.id)}/${framework}-${caseSlug(
        contextPath
          .split("/")
          .pop()!
          .replace(/\.json$/, ""),
      )}-${item.key === "baseline" ? "baseline" : caseSlug(item.key).slice(0, 32) + "-" + hash(item.key).slice(0, 10)}.avora-test.json`,
      warnings: [...caseWarnings],
      scenario: {
        formatVersion: 1,
        id: "generated-" + hash(key).slice(0, 20),
        label: `${variant.title || variant.id} · ${item.label}`,
        framework,
        variantId: variant.id,
        context: contextPath,
        configuration: {
          lineValues: state.values,
          deletedLineIds: state.deleted,
        },
        inputs,
      },
    });
    outputSize.bytes += Buffer.byteLength(
      JSON.stringify(results[results.length - 1]),
    );
    if (outputSize.bytes > 6_000_000)
      throw new Error(
        "Sample data exceeds 6 MB. Reduce fixture sizes or the case budget.",
      );
    for (const line of resolved.resolvedLines)
      for (const f of visibleFields(line, rowValues(line, state))) {
        if (f.kind !== "select") continue;
        for (const option of f.options || []) {
          if (option.overrideElements)
            warnings.add(
              `Field ${f.id} uses legacy element overrides; review the generated input samples.`,
            );
          const value = f.multiSelect ? [option.value] : option.value;
          const id = line.lineType === "optional-multiple" ? `${f.id}_0` : f.id;
          if (hash(state.values[id]) === hash(value)) continue;
          enqueue(
            { ...clone(state), values: { ...state.values, [id]: value } },
            targetKey("option", f.id, option.value),
            `${f.label || f.id}: ${option.label || option.value}`,
          );
        }
      }
    for (const line of variant.lines)
      if (
        line.lineType === "optional" ||
        line.lineType === "optional-multiple"
      ) {
        for (const count of line.lineType === "optional"
          ? [1]
          : [1, 2].filter((n) => !line.max || n <= line.max)) {
          const next = clone(state);
          next.deleted = next.deleted.filter((id) => id !== line.id);
          if (line.lineType === "optional-multiple")
            next.values[`${line.id}_count`] = String(count);
          if (resolve(next).resolvedLines.some((l) => l.id === line.id))
            enqueue(
              next,
              targetKey("line", line.id, count),
              `${line.label || line.id}${line.lineType === "optional-multiple" ? ` × ${count}` : " enabled"}`,
            );
        }
      }
    const conditions = [
      ...(variant.conditions || []).map((r) => ({
        key: r.id,
        label: r.label,
        group: r.condition,
      })),
      ...variant.lines
        .filter((l) => l.displayConditions?.length)
        .map((l) => ({
          key: `line-${l.id}`,
          label: l.label || l.id,
          group: {
            type: "group" as const,
            id: l.id,
            logicalOperator: "AND" as const,
            conditions: l.displayConditions!.map((c, i) => ({
              type: "condition" as const,
              id: String(i),
              target: { type: "field" as const, fieldId: c.fieldId },
              operator: c.operator,
              value: c.value,
            })),
          },
        })),
    ];
    for (const condition of conditions)
      for (const [i, values] of witnesses(condition.group, state).entries()) {
        const next = clone(state);
        for (const [encoded, value] of Object.entries(values)) {
          const [kind, id] = JSON.parse(encoded);
          if (kind === "field") next.values[id] = value;
          else if (value === "true")
            next.deleted = next.deleted.filter((lineId) => lineId !== id);
          else if (!next.deleted.includes(id)) next.deleted.push(id);
        }
        if (
          evaluateConditionGroup(
            condition.group,
            next.values,
            resolve(next).evaluationContext.lineVisibility,
          )
        )
          enqueue(
            next,
            targetKey("condition", condition.key, i),
            condition.label || condition.key,
          );
      }
  }
  return {
    samples: results,
    warnings: [...warnings],
    limited: queue.length > 0 || clipped,
  };
}

export function sampleNodeCases(
  manifest: NodeManifest,
  contextPath: string,
  context: WorkspaceContext,
  budget = 24,
) {
  if (!Number.isInteger(budget) || budget < 1 || budget > 100)
    throw new Error("Case budget must be an integer from 1 to 100.");
  validateComplexity(manifest.payload.node_config);
  validateComplexity(context.caseFixtures);
  const mappings = manifest.templates
    .flatMap((t) => t.variantIds.map((id) => ({ framework: t.framework, id })))
    .sort((a, b) =>
      `${a.framework}:${a.id}`.localeCompare(`${b.framework}:${b.id}`),
    );
  const supported = mappings.filter((m) => m.framework === "fastapi"),
    warnings: string[] = [];
  if (
    context.graph.nodes.some((n) => n.type !== "enumNode" && n.type !== "enum")
  )
    warnings.push(
      "This context contains workspace entities. Local execution currently supports empty or enum-only contexts.",
    );
  if (supported.length > budget)
    throw new Error(
      `Budget ${budget} is too small for ${supported.length} variant baselines. Increase it.`,
    );
  for (const m of mappings.filter((m) => m.framework !== "fastapi"))
    warnings.push(
      `${m.framework}:${m.id} skipped: no local execution adapter yet.`,
    );
  const outputSize = { bytes: 0 };
  const groups = supported.map((m) =>
    variantSamples(
      manifest.payload.node_config.variants.find(
        (v: ConfigVariant) => v.id === m.id,
      ),
      m.framework,
      contextPath,
      context,
      budget - supported.length + 2,
      outputSize,
    ),
  );
  const samples: CaseSample[] = [];
  // Baselines first, then fair distribution between variants.
  for (
    let i = 0;
    samples.length < budget && groups.some((g) => g.samples[i]);
    i++
  )
    for (const group of groups)
      if (group.samples[i] && samples.length < budget)
        samples.push(group.samples[i]);
  if (
    groups.some((g) => g.limited) ||
    groups.reduce((n, g) => n + g.samples.length, 0) > samples.length
  )
    warnings.push(
      `Stopped at the ${budget}-case budget. Coverage is representative, not exhaustive.`,
    );
  warnings.push(...groups.flatMap((g) => g.warnings));
  return { samples, warnings: [...new Set(warnings)] };
}
