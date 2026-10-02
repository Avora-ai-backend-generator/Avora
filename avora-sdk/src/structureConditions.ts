/** Shared public editor rules. No code generation or execution. */
import type { ConditionGroup, ConditionRule, ConditionTarget } from '../types/structure';

type ConditionValue = string | string[];

const normalizeConditionValue = (value: ConditionValue | undefined): ConditionValue => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    return value ?? '';
};

const asText = (value: ConditionValue): string => Array.isArray(value) ? value.join(', ') : value;
export function evaluateConditionGroup(
    group: ConditionGroup,
    lineValues: Record<string, ConditionValue>,
    lineVisibility: Record<string, boolean>,
    currentAttributeContext?: { lineId: string, attributeName: string, instanceId?: string }
): boolean {
    const evaluateSub = (sub: any): boolean => {
        if (sub.type === 'group') {
            if (!sub.conditions || sub.conditions.length === 0) return true;
            if (sub.logicalOperator === 'AND') {
                return sub.conditions.every((c: any) => evaluateSub(c));
            } else {
                return sub.conditions.some((c: any) => evaluateSub(c));
            }
        } else if (sub.type === 'condition') {
            const target = sub.target as ConditionTarget;
            if (!target) return false;

            let valToCompare: ConditionValue = '';
            let isLineVisible = lineVisibility[target.lineId || ''] === true;

            if (target.type === 'field') {
                valToCompare = normalizeConditionValue(lineValues[target.fieldId || '']);
            } else if (target.type === 'line') {
                valToCompare = isLineVisible ? 'true' : 'false';
            } else if (target.type === 'genericAttribute') {
                // Match against either the parent line id OR the instance id
                const contextMatchesTarget = currentAttributeContext && (
                    currentAttributeContext.lineId === target.lineId ||
                    currentAttributeContext.instanceId === target.lineId
                );
                if (contextMatchesTarget) {
                    // The comparison value IS the attribute NAME itself.
                    // e.g. condition "attribute name isIn ['username', 'email']" → show those rows.
                    valToCompare = currentAttributeContext!.attributeName;
                } else {
                    return false; // Cannot evaluate without context
                }
            }

            let subValueRaw = sub.value;
            if (sub.valueSource === 'field' && sub.valueFieldId) {
                subValueRaw = normalizeConditionValue(lineValues[sub.valueFieldId]);
            }

            const compareText = asText(valToCompare);
            const compareValues = Array.isArray(valToCompare) ? valToCompare : [valToCompare].filter(Boolean);
            const numVal = parseFloat(compareText);

            const subValueText = asText(subValueRaw);
            const subValues = Array.isArray(subValueRaw) ? subValueRaw : [subValueRaw].filter(Boolean);
            const subNumVal = parseFloat(subValueText);

            switch (sub.operator) {
                case 'equals':
                    if (Array.isArray(valToCompare) || Array.isArray(subValueRaw)) {
                        return compareValues.length === subValues.length && compareValues.every(v => subValues.includes(v));
                    }
                    return compareText === subValueText;
                case 'notEquals':
                    if (Array.isArray(valToCompare) || Array.isArray(subValueRaw)) {
                        return !(compareValues.length === subValues.length && compareValues.every(v => subValues.includes(v)));
                    }
                    return compareText !== subValueText;
                case 'isIn':
                    return compareValues.some(v => subValues.includes(v));
                case 'contains':
                    if (Array.isArray(valToCompare)) {
                        return subValues.every(v => compareValues.includes(v));
                    }
                    return compareText.includes(subValueText);
                case 'isEmpty': return Array.isArray(valToCompare) ? compareValues.length === 0 : !compareText;
                case 'isNotEmpty': return Array.isArray(valToCompare) ? compareValues.length > 0 : !!compareText;
                case 'isAppearing': return isLineVisible;
                case 'isNotAppearing': return !isLineVisible;
                case 'greaterThan': return !isNaN(numVal) && !isNaN(subNumVal) && numVal > subNumVal;
                case 'lessThan': return !isNaN(numVal) && !isNaN(subNumVal) && numVal < subNumVal;
                case 'greaterThanOrEqual': return !isNaN(numVal) && !isNaN(subNumVal) && numVal >= subNumVal;
                case 'lessThanOrEqual': return !isNaN(numVal) && !isNaN(subNumVal) && numVal <= subNumVal;
                default: return false;
            }
        }
        return false;
    };

    return evaluateSub(group);
}

export interface ConditionEvaluationResult {
    lineVisibility: Record<string, boolean>;
    lineOverrides: Record<string, string>;
    fieldVisibility: Record<string, boolean>;
    fieldOverrides: Record<string, any>;
    packVisibility: Record<string, boolean>;
    packOverrides: Record<string, any>;
}

export function evaluateConditions(
    variant: { lines: any[], elementPacks?: any[], conditions?: ConditionRule[] } | undefined,
    lineValues: Record<string, ConditionValue>,
    deletedLineIds: string[] = []
): ConditionEvaluationResult {
    const lineVisibility: Record<string, boolean> = {};
    const lineOverrides: Record<string, string> = {};
    const fieldVisibility: Record<string, boolean> = {};
    const fieldOverrides: Record<string, any> = {};
    const packVisibility: Record<string, boolean> = {};
    const packOverrides: Record<string, any> = {};

    if (!variant) {
        return { lineVisibility, lineOverrides, fieldVisibility, fieldOverrides, packVisibility, packOverrides };
    }

    const conditions = variant.conditions || [];

    // 1. Initial Defaults
    const setDefaults = (visibilityMap: Record<string, boolean>) => {
        (variant.lines || []).forEach(l => {
            if (!l?.id) return;

            const hasShow = conditions.some(rule =>
                rule.behaviors?.some(beh => beh.actionType === 'line' && beh.changeType === 'show' && beh.lineId === l.id)
            );
            const hasHide = conditions.some(rule =>
                rule.behaviors?.some(beh => beh.actionType === 'line' && beh.changeType === 'hide' && beh.lineId === l.id)
            );

            if (deletedLineIds.includes(l.id)) {
                visibilityMap[l.id] = false;
            } else {
                visibilityMap[l.id] = hasHide || !hasShow;
            }

            // Initialize instances
            if (l.instances) {
                l.instances.forEach((inst: any) => {
                    const instHasShow = conditions.some(rule =>
                        rule.behaviors?.some(beh => beh.actionType === 'line' && beh.changeType === 'show' && beh.lineId === inst.instanceId)
                    );
                    const instHasHide = conditions.some(rule =>
                        rule.behaviors?.some(beh => beh.actionType === 'line' && beh.changeType === 'hide' && beh.lineId === inst.instanceId)
                    );
                    visibilityMap[inst.instanceId] = instHasHide || !instHasShow;
                });
            }
        });

        (variant.elementPacks || []).forEach(p => {
            if (!p?.id) return;
            const hasShow = conditions.some(rule =>
                rule.behaviors?.some(beh => beh.actionType === 'element' && beh.changeType === 'show' && beh.packId === p.id)
            );
            const hasHide = conditions.some(rule =>
                rule.behaviors?.some(beh => beh.actionType === 'element' && beh.changeType === 'hide' && beh.packId === p.id)
            );
            visibilityMap[p.id] = hasHide || !hasShow;
        });

        const hasBaseShow = conditions.some(rule =>
            rule.behaviors?.some(beh => beh.actionType === 'element' && beh.changeType === 'show' && beh.packId === 'base')
        );
        const hasBaseHide = conditions.some(rule =>
            rule.behaviors?.some(beh => beh.actionType === 'element' && beh.changeType === 'hide' && beh.packId === 'base')
        );
        visibilityMap['base'] = hasBaseHide || !hasBaseShow;
    };

    setDefaults(lineVisibility);

    // Attribute behaviors are evaluated dynamically per attribute later

    // 2. Multi-pass Evaluation
    // We iterate up to 5 times to handle dependencies between conditions (e.g. Rule A depends on Line B which is shown by Rule C)
    let lastVisibilityState = JSON.stringify(lineVisibility);
    for (let pass = 0; pass < 5; pass++) {
        conditions.forEach(rule => {
            if (!rule.condition) return;
            const met = evaluateConditionGroup(rule.condition, lineValues, lineVisibility);

            if (met) {
                rule.behaviors?.forEach((beh: any) => {
                    if (beh.actionType === 'line') {

                        if (beh.changeType === 'show') lineVisibility[beh.lineId] = true;
                        if (beh.changeType === 'hide') lineVisibility[beh.lineId] = false;
                        if (beh.changeType === 'append') {
                            lineVisibility[beh.lineId] = true;
                        } else if (beh.changeType === 'instance') {
                            lineOverrides[beh.lineId] = beh.instanceId;
                            lineVisibility[beh.lineId] = true;
                        }
                    } else if (beh.actionType === 'element') {
                        if (beh.changeType === 'show') packVisibility[beh.packId] = true;
                        if (beh.changeType === 'hide') packVisibility[beh.packId] = false;
                        if (beh.changeType === 'append') {
                            const conditionLineIds = collectConditionLineIds(rule.condition);
                            const conditionRepeatLine = (variant.lines || []).find(line =>
                                line.lineType === 'optional-multiple' && conditionLineIds.has(line.id)
                            );
                            const explicitRepeatLine = (variant.lines || []).find(line =>
                                line.lineType === 'optional-multiple' && line.id === beh.lineId
                            );
                            packVisibility[beh.packId] = true;
                            packOverrides[beh.packId] = {
                                mode: 'append',
                                repeatLineId: conditionRepeatLine?.id || explicitRepeatLine?.id,
                            };
                        } else if (beh.changeType === 'instance') {
                            packOverrides[beh.packId] = { mode: 'instance', instanceId: beh.instanceId };
                            packVisibility[beh.packId] = true;
                        }
                    }
                });
            }
        });

        const currentVisibilityState = JSON.stringify(lineVisibility);
        if (currentVisibilityState === lastVisibilityState) break; // Stable
        lastVisibilityState = currentVisibilityState;
    }

    return { lineVisibility, lineOverrides, fieldVisibility, fieldOverrides, packVisibility, packOverrides };
}

/** Recursively collect all lineIds referenced in a condition group tree */
function collectConditionLineIds(group: ConditionGroup): Set<string> {
    const ids = new Set<string>();
    const walk = (node: any) => {
        if (!node) return;
        if (node.type === 'group') {
            (node.conditions || []).forEach(walk);
        } else if (node.type === 'condition') {
            if (node.target?.lineId) ids.add(node.target.lineId);
        }
    };
    walk(group);
    return ids;
}

export function evaluateAttributeBehaviors(
    conditions: ConditionRule[],
    lineValues: Record<string, ConditionValue>,
    lineVisibility: Record<string, boolean>,
    attributeContext: { lineId: string, attributeName: string, instanceId?: string }
): { hide: boolean, overrideLineId?: string } {
    const result = { hide: false, overrideLineId: undefined as string | undefined };

    // Build the set of lineIds that identify this attribute context
    // (could be the parent line id or the instance id)
    const contextIds = new Set([attributeContext.lineId]);
    if (attributeContext.instanceId) contextIds.add(attributeContext.instanceId);

    // Default visibility logic for this specific attribute:
    // If ANY genericAttribute 'show' rule references one of our context IDs,
    // all attributes for this line should be hidden by default (explicit show required).
    const hasShowAttr = conditions.some(r =>
        r.behaviors?.some(b => b.actionType === 'genericAttribute' && b.changeType === 'show') &&
        (() => {
            const ids = collectConditionLineIds(r.condition);
            return [...contextIds].some(id => ids.has(id));
        })()
    );
    const hasHideAttr = conditions.some(r =>
        r.behaviors?.some(b => b.actionType === 'genericAttribute' && b.changeType === 'hide') &&
        (() => {
            const ids = collectConditionLineIds(r.condition);
            return [...contextIds].some(id => ids.has(id));
        })()
    );
    // If there are ANY show rules for this line's attributes, hide by default unless explicitly shown.
    result.hide = hasHideAttr || (!hasHideAttr && hasShowAttr);

    // Evaluate rules — pass both parent lineId and instanceId so the evaluator can match
    conditions.forEach(rule => {
        if (!rule.condition) return;
        const met = evaluateConditionGroup(rule.condition, lineValues, lineVisibility, attributeContext);

        if (met) {
            rule.behaviors?.forEach((beh: any) => {
                if (beh.actionType === 'genericAttribute') {
                    if (beh.changeType === 'show') result.hide = false;
                    if (beh.changeType === 'hide') result.hide = true;
                    if (beh.changeType === 'override') result.overrideLineId = beh.overrideLineId;
                }
            });
        }
    });

    return result;
}
