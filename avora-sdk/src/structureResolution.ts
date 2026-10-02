/** Pure public UI structure resolution, extracted from SharedActionNodeBody. */
import type {ConfigLine, ConfigVariant, NodeElements, LogicFlowDefinition, RequestKeyValuePair} from '../types/structure';
import {evaluateConditions} from './structureConditions';
import {mergeLineValuesWithDefaults} from './structureDefaults';
const DYNAMIC_IO_TYPE = 'dynamic';
const isArrayType = (type: string) => type.trim().startsWith('[') && type.trim().endsWith(']');
const unwrapArrayType = (type: string) => isArrayType(type) ? type.trim().slice(1,-1).trim() : type;
const wrapArrayType = (type: string) => isArrayType(type) ? type : `[${type}]`;
const isDynamicIOType = (type: string) => unwrapArrayType(type).trim() === DYNAMIC_IO_TYPE;
const parseOptionalFlag = (value: unknown): boolean => {
    if (value === true) return true;
    if (typeof value === 'string') {
        return value.trim().toLowerCase() === 'true';
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
};

export const isOptionalItem = (item: any): boolean => parseOptionalFlag(item?.optional);

export const normalizeErrorMessage = (message: unknown): string =>
    typeof message === 'string' ? message.trim() : String(message ?? '').trim();

export const sameErrorDefinition = (a: any, b: any): boolean => {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;

    const aMessage = normalizeErrorMessage(a.message);
    const bMessage = normalizeErrorMessage(b.message);
    if (!aMessage || !bMessage) return false;

    return String(a.status ?? '') === String(b.status ?? '') && aMessage === bMessage;
};

const mergeErrorDefinition = (base: any, incoming: any) => ({
    ...base,
    ...incoming,
    id: base?.id || incoming?.id,
    message: base?.message || incoming?.message || 'Error',
    status: base?.status ?? incoming?.status,
    info: base?.info || incoming?.info,
    // If any duplicate entry is required, keep the merged one required.
    optional: isOptionalItem(base) && isOptionalItem(incoming)
});

export const dedupeErrorDefinitions = (errors: any[] = []): any[] => {
    const deduped: any[] = [];
    errors.forEach((error) => {
        const index = deduped.findIndex((candidate) => sameErrorDefinition(candidate, error));
        if (index === -1) {
            deduped.push(error);
            return;
        }
        deduped[index] = mergeErrorDefinition(deduped[index], error);
    });
    return deduped;
};

const getSelectValue = (value: string | string[] | undefined, fallback?: string | string[]) => {
    const resolved = value ?? fallback;
    return Array.isArray(resolved) ? (resolved[0] || '') : (resolved || '');
};

const normalizeRuntimeIOBaseType = (type?: string): string => {
    const baseType = unwrapArrayType(type || '').trim();
    const normalized = baseType.toLowerCase();

    if (normalized === 'object') return 'object';
    if (normalized === 'childobject') return 'childObject';
    if (normalized === DYNAMIC_IO_TYPE.toLowerCase()) return DYNAMIC_IO_TYPE;
    return baseType;
};


export function resolveNodeStructure(currentVariant: ConfigVariant, values: Record<string,string|string[]> = {}, deleted: string[] = [], requestGroup = '', showUnresolvedDynamicType = true,
    attributeType?: (fieldId: string | undefined, lines: ConfigLine[], values: Record<string,string|string[]>) => string | undefined) {

        const elements: NodeElements = {
            inputs: { title: 'Inputs', canAdd: false, defaults: [] },
            outputs: { title: 'Outputs', canAdd: false, defaults: [] },
            logicFlows: [],
            errors: []
        };
        const lineValues = mergeLineValuesWithDefaults(currentVariant, values);
        const deletedLineIds = deleted || [];

        const {
            lineVisibility,
            fieldVisibility,
            fieldOverrides,
            packVisibility,
            lineOverrides,
            packOverrides
        } = evaluateConditions(currentVariant, lineValues as Record<string, string>, deletedLineIds);

        const evaluationContext = {
            conditions: currentVariant.conditions || [],
            lineValues: lineValues as Record<string, string>,
            lineVisibility,
            allLines: currentVariant.lines || []
        };

        // ── 2. Collect & Process Lines ──
        const allLines = [...(currentVariant.lines || [])];
        const processedLines: ConfigLine[] = [];

        // --- Extract optional elements from the base variant ---
        const optElements: {
            logicFlows: LogicFlowDefinition[];
            inputs: Partial<RequestKeyValuePair>[];
            outputs: Partial<RequestKeyValuePair>[];
            errors: any[];
        } = { logicFlows: [], inputs: [], outputs: [], errors: [] };

        if (elements.logicFlows) {
            optElements.logicFlows.push(...elements.logicFlows.filter(f => isOptionalItem(f)));
            elements.logicFlows = elements.logicFlows.filter(f => !isOptionalItem(f));
        }
        if (elements.inputs?.defaults) {
            optElements.inputs.push(...elements.inputs.defaults.filter((d: any) => isOptionalItem(d)));
            elements.inputs = { ...elements.inputs, defaults: elements.inputs.defaults.filter((d: any) => !isOptionalItem(d)) };
        }
        if (elements.outputs?.defaults) {
            optElements.outputs.push(...elements.outputs.defaults.filter((d: any) => isOptionalItem(d)));
            elements.outputs = { ...elements.outputs, defaults: elements.outputs.defaults.filter((d: any) => !isOptionalItem(d)) };
        }
        if (elements.errors) {
            optElements.errors.push(...elements.errors.filter((e: any) => isOptionalItem(e)));
            elements.errors = elements.errors.filter((e: any) => !isOptionalItem(e));
        }

        const applyAppendElements = (appendEl: Partial<NodeElements>, indexVar: number, isMultiple: boolean) => {
            const replaceText = (text: string | undefined, separator: string = ' ') => {
                if (!text) return text;
                if (text.includes('{index}')) {
                    return text.replace(/{index}/g, String(indexVar + 1));
                }
                if (isMultiple) {
                    return `${text}${separator}${indexVar + 1}`;
                }
                return text;
            };

            if (appendEl.logicFlows) {
                const flows = appendEl.logicFlows.map(f => ({
                    ...f,
                    id: replaceText(f.id, '-') || f.id,
                    title: replaceText(f.title, ' ') || f.title
                }));

                const required = flows.filter(f => !isOptionalItem(f));
                const optional = flows.filter(f => isOptionalItem(f));

                elements.logicFlows = [...(elements.logicFlows || []), ...required];
                optElements.logicFlows.push(...optional);
            }

            if (appendEl.inputs) {
                if (appendEl.inputs.canAdd !== undefined) {
                    elements.inputs.canAdd = appendEl.inputs.canAdd;
                }

                if (appendEl.inputs.defaults) {
                    const inputs = appendEl.inputs.defaults.map(d => ({
                        ...d,
                        id: replaceText(d.id, '-') || d.id,
                        key: replaceText(d.key, '') || d.key,
                    }));

                    const required = inputs.filter((d: any) => !isOptionalItem(d));
                    const optional = inputs.filter((d: any) => isOptionalItem(d));

                    elements.inputs = {
                        ...elements.inputs,
                        defaults: [...(elements.inputs.defaults || []), ...required]
                    };
                    optElements.inputs.push(...optional);
                }
            }

            if (appendEl.outputs) {
                if (appendEl.outputs.canAdd !== undefined) {
                    elements.outputs.canAdd = appendEl.outputs.canAdd;
                }

                if (appendEl.outputs.defaults) {
                    const outputs = appendEl.outputs.defaults.map(d => ({
                        ...d,
                        id: replaceText(d.id, '-') || d.id,
                        key: replaceText(d.key, '') || d.key,
                    }));

                    const required = outputs.filter((d: any) => !isOptionalItem(d));
                    const optional = outputs.filter((d: any) => isOptionalItem(d));

                    elements.outputs = {
                        ...elements.outputs,
                        defaults: [...(elements.outputs.defaults || []), ...required]
                    };
                    optElements.outputs.push(...optional);
                }
            }

            if (appendEl.errors) {
                const errors = appendEl.errors.map(e => ({
                    ...e,
                    id: replaceText(e.id, '-') || e.id,
                    message: replaceText(e.message, ' ') || e.message
                }));
                const required = errors.filter((e: any) => !isOptionalItem(e));
                const optional = errors.filter((e: any) => isOptionalItem(e));
                elements.errors = [
                    ...(elements.errors || []),
                    ...required
                ];
                optElements.errors.push(...optional);
            }
        };

        // Track object-source selections for type resolution
        let parentClass = '';  // First select with source:'objects' (no relatedToField)
        let childClass = '';   // Select with source:'objects' AND relatedToField set

        allLines.forEach(line => {
            if (deletedLineIds.includes(line.id) && lineVisibility[line.id] !== true) return;
            if (lineVisibility[line.id] === false) return;

            // Apply line instance override if defined by condition behaviors
            let activeLine = line;
            if (lineOverrides[line.id]) {
                const instance = line.instances?.find(i => i.instanceId === lineOverrides[line.id]);
                if (instance) activeLine = instance;
            }

            // Legacy displayConditions
            if (activeLine.displayConditions && activeLine.displayConditions.length > 0) {
                const conditionsMet = activeLine.displayConditions.every(cond => {
                    const fieldValue = lineValues[cond.fieldId] || '';
                    if (cond.operator === 'equals') return fieldValue === cond.value;
                    if (cond.operator === 'notEquals') return fieldValue !== cond.value;
                    return true;
                });
                if (!conditionsMet) return;
            }

            // Process appendPackId for this line
            if (activeLine.appendPackId) {
                const pack = activeLine.appendPackId === 'base'
                    ? currentVariant.elements
                    : (currentVariant.elementPacks || []).find(p => p.id === activeLine.appendPackId)?.elements;
                if (pack) {
                    if (activeLine.lineType === 'optional-multiple') {
                        const count = parseInt(getSelectValue(lineValues[`${activeLine.id}_count`]) || '1', 10);
                        for (let i = 0; i < count; i++) {
                            applyAppendElements(pack, i, true);
                        }
                    } else {
                        applyAppendElements(pack, 0, false);
                    }
                }
            }

            // Process appendElements for dynamic programmatic lines
            if (activeLine.appendElements) {
                if (activeLine.lineType === 'optional-multiple') {
                    const count = parseInt(getSelectValue(lineValues[`${activeLine.id}_count`]) || '1', 10);
                    for (let i = 0; i < count; i++) {
                        applyAppendElements(activeLine.appendElements, i, true);
                    }
                } else {
                    applyAppendElements(activeLine.appendElements, 0, false);
                }
            }

            // Apply field-level overrides and visibility
            const processedFields = activeLine.fields.map(field => {
                if (!field || !field.id) return null;
                if ((fieldVisibility || {})[field.id] === false) return null;
                const overrides = (fieldOverrides || {})[field.id];
                let resolvedField = field;
                if (overrides) {
                    resolvedField = { ...field, ...overrides };
                }

                // If this is a primary object-source select and we have a request group,
                // set it as the default value if not already set.
                if (resolvedField.kind === 'select' && (resolvedField as any).source === 'objects' && !(resolvedField as any).relatedToField && requestGroup) {
                    if (!resolvedField.defaultValue) {
                        resolvedField = { ...resolvedField, defaultValue: requestGroup } as any;
                    }
                }

                return resolvedField;
            }).filter(Boolean) as any[];

            processedLines.push({ ...activeLine, fields: processedFields });

            processedFields.forEach(field => {
                if (field.kind === 'select') {
                    const val = getSelectValue(lineValues[field.id], field.defaultValue);
                    const sf = field as any;

                    // Track parent/child class selections
                    if (sf.source === 'objects' && val) {
                        if (!sf.relatedToField) {
                            parentClass = val;
                        } else {
                            childClass = val;
                        }
                    }

                    const option = (field.options || []).find((o: any) => o && o.value === val);
                    if (option?.overridePackId) {
                        const pack = option.overridePackId === 'base'
                            ? currentVariant.elements
                            : (currentVariant.elementPacks || []).find(p => p.id === option.overridePackId)?.elements;

                        if (pack) {
                            if (pack.inputs) elements.inputs = { ...elements.inputs, ...pack.inputs };
                            if (pack.outputs) elements.outputs = { ...elements.outputs, ...pack.outputs };
                            if (pack.logicFlows) elements.logicFlows = pack.logicFlows;
                            if (pack.errors) elements.errors = pack.errors;
                        }
                    }
                }
            });
        });

        // ── 3. Apply Pack Visibility & Overrides ──
        const getPackRepeatCount = (repeatLineId?: string): number => {
            if (!repeatLineId) return 1;
            const repeatLine = (currentVariant.lines || []).find(line => line.id === repeatLineId);
            if (!repeatLine || lineVisibility[repeatLine.id] !== true) return 0;
            if (repeatLine.lineType !== 'optional-multiple') return 1;

            const parsedCount = parseInt(getSelectValue(lineValues[`${repeatLine.id}_count`]) || '1', 10);
            return Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
        };

        const appendPackForVisibleLineInstances = (
            packElements: Partial<NodeElements>,
            override: { repeatLineId?: string; elements?: Partial<NodeElements> }
        ) => {
            const repeatCount = getPackRepeatCount(override.repeatLineId);
            const useNumbering = repeatCount > 1;
            for (let index = 0; index < repeatCount; index++) {
                applyAppendElements(packElements, index, useNumbering);
                if (override.elements) applyAppendElements(override.elements, index, useNumbering);
            }
        };

        // Handle base pack first
        if ((packVisibility as any)['base'] !== false) {
            const override = packOverrides['base'];
            const packElements = currentVariant.elements || {};
            if (override) {
                if (override.mode === 'override') {
                    if (override.elements) applyAppendElements(override.elements, 0, false);
                } else if (override.mode === 'append') {
                    appendPackForVisibleLineInstances(packElements, override);
                } else if (override.mode === 'instance') {
                    const instance = currentVariant.instances?.find((i: any) => i.instanceId === override.instanceId);
                    if (instance) applyAppendElements(instance.elements, 0, false);
                }
            } else {
                applyAppendElements(packElements, 0, false);
            }
        }

        (currentVariant.elementPacks || []).forEach(p => {
            if (packVisibility[p.id] !== false) {
                const override = packOverrides[p.id];
                const packElements = p.elements || {};

                if (override) {
                    if (override.mode === 'override') {
                        // Apply elements from override
                        if (override.elements) applyAppendElements(override.elements, 0, false);
                    } else if (override.mode === 'append') {
                        appendPackForVisibleLineInstances(packElements, override);
                    } else if (override.mode === 'instance') {
                        const instance = p.instances?.find((i: any) => i.instanceId === override.instanceId);
                        if (instance) applyAppendElements(instance.elements, 0, false);
                    }
                } else if (packVisibility[p.id]) {
                    applyAppendElements(packElements, 0, false);
                }
            }
        });

        // Deduplicate errors coming from base + packs (same status/message).
        const requiredErrors = dedupeErrorDefinitions(elements.errors || []);
        const optionalErrors = dedupeErrorDefinitions(optElements.errors || [])
            .filter(optionalErr => !requiredErrors.some(requiredErr => sameErrorDefinition(requiredErr, optionalErr)));

        elements.errors = requiredErrors;
        optElements.errors = optionalErrors;

        const resolveIODefaultType = (def: any) => {
            const rawType = String(def?.type || 'String');
            const arrayType = isArrayType(rawType);
            const baseType = normalizeRuntimeIOBaseType(rawType);

            let resolvedType = rawType;
            if (baseType === 'object' && (parentClass || requestGroup)) {
                resolvedType = parentClass || requestGroup;
            } else if (baseType === 'childObject' && childClass) {
                resolvedType = childClass;
            } else if (baseType === DYNAMIC_IO_TYPE) {
                resolvedType = attributeType?.(def.typePointerFieldId, processedLines, lineValues) || (showUnresolvedDynamicType ? DYNAMIC_IO_TYPE : 'String');
            }

            if (arrayType && !isArrayType(resolvedType)) {
                return wrapArrayType(resolvedType);
            }
            return resolvedType;
        };

        const resolveElementDefaults = (elemGroup: any) => {
            if (!elemGroup?.defaults) return elemGroup;
            return {
                ...elemGroup,
                defaults: elemGroup.defaults.map((def: any) => {
                    const rawType = String(def?.type || '');
                    const isDynamic = isDynamicIOType(rawType);
                    return {
                        ...def,
                        type: resolveIODefaultType(def),
                        typeMode: isDynamic ? 'dynamic' : def.typeMode,
                    };
                }),
            };
        };

        elements.inputs = resolveElementDefaults(elements.inputs);
        elements.outputs = resolveElementDefaults(elements.outputs);
        optElements.inputs = resolveElementDefaults({ defaults: optElements.inputs }).defaults || [];
        optElements.outputs = resolveElementDefaults({ defaults: optElements.outputs }).defaults || [];

        return { resolvedLines: processedLines, elements, optionalElements: optElements, evaluationContext };

}
