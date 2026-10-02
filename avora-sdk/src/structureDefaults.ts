/** Shared public editor rules. No code generation or execution. */
import type { ConfigVariant, DefaultValueMode, InputField, SelectField } from '../types/structure';

type ValueField = InputField | SelectField;
type FieldValue = string | string[] | undefined;

export const ENV_TAG_INDEX = 'ENV';

const ENV_TAG_REGEX = /^\{\{ENV\}\}\.([a-zA-Z_][a-zA-Z0-9_]*)$/;
const INPUT_TAG_REGEX = /\{\{([a-zA-Z0-9_-]+)\}\}(?!\.)/g;

const asSelectValues = (value: FieldValue): string[] => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    return value ? [value] : [];
};

export const getSelectDefaultValues = (value: FieldValue, fallback?: FieldValue): string[] => {
    const resolved = (value !== undefined && value !== '') ? value : fallback;
    return asSelectValues(resolved);
};

export const getSelectDefaultValue = (value: FieldValue, fallback?: FieldValue): string => {
    const resolved = (value !== undefined && value !== '') ? value : fallback;
    if (Array.isArray(resolved)) {
        return resolved[0] || '';
    }
    return resolved || '';
};

export const buildEnvTagValue = (envKey: string): string => {
    const trimmed = envKey.trim();
    return trimmed ? `{{${ENV_TAG_INDEX}}}.${trimmed}` : '';
};

export const parseEnvKeyFromValue = (value: FieldValue): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const match = value.trim().match(ENV_TAG_REGEX);
    return match?.[1];
};

export const parseInputRefsFromValue = (value: FieldValue): string[] => {
    if (typeof value !== 'string') return [];
    const refs = new Set<string>();
    for (const match of value.matchAll(INPUT_TAG_REGEX)) {
        const ref = match[1];
        if (ref && ref !== ENV_TAG_INDEX) refs.add(ref);
    }
    return [...refs];
};

export const buildInputTagValue = (refs: string[]): string => {
    const uniqRefs = [...new Set(refs.map(ref => ref.trim()).filter(Boolean))];
    if (uniqRefs.length === 0) return '';
    return uniqRefs.map(ref => `{{${ref}}}`).join(' ');
};

export const inferDefaultValueMode = (field: ValueField): DefaultValueMode => {
    if (!field || typeof field !== 'object') return 'custom';
    if (field.defaultValueMode) return field.defaultValueMode;
    if (field.defaultValueFieldId) return 'field';

    if (field.defaultValueEnvKey || parseEnvKeyFromValue(field.defaultValue as FieldValue)) {
        return 'env';
    }

    if ((field.defaultValueInputRefs?.length || 0) > 0 || parseInputRefsFromValue(field.defaultValue as FieldValue).length > 0) {
        return 'input';
    }

    if (field.kind === 'select') {
        const selectField = field as SelectField;
        const values = getSelectDefaultValues(selectField.defaultValue);
        if (values.length > 0) {
            if (selectField.source === 'conditions') {
                // For conditions source, we don't have a static options list to check against in this utility
                // so we trust the value if it's set and the mode is not explicitly something else.
                return 'suggestion';
            }
            const options = Array.isArray(selectField.options) ? selectField.options : [];
            const optionValues = new Set(options.map(option => option.value));
            if (values.every(value => optionValues.has(value))) {
                return 'suggestion';
            }
        }
    }

    return 'custom';
};

const normalizeSelectModeValue = (field: SelectField, value: FieldValue): string | string[] => {
    if (field.multiSelect) {
        return getSelectDefaultValues(value);
    }
    return getSelectDefaultValue(value);
};

export const resolveFieldDefaultValue = (
    field: ValueField,
    resolveFromFieldId: (fieldId: string) => FieldValue
): FieldValue => {
    const mode = inferDefaultValueMode(field);

    if (mode === 'field') {
        const linkedFieldId = field.defaultValueFieldId?.trim();
        const linkedValue = linkedFieldId ? resolveFromFieldId(linkedFieldId) : undefined;

        if (linkedValue !== undefined) {
            if (field.kind === 'select') {
                return normalizeSelectModeValue(field, linkedValue);
            }
            return Array.isArray(linkedValue) ? (linkedValue[0] || '') : linkedValue;
        }

        if (field.kind === 'select' && field.multiSelect) return [];
        return '';
    }

    if (mode === 'env') {
        const envKey = (field.defaultValueEnvKey || parseEnvKeyFromValue(field.defaultValue as FieldValue) || '').trim();
        return envKey ? buildEnvTagValue(envKey) : '';
    }

    if (mode === 'input') {
        const refs = (field.defaultValueInputRefs && field.defaultValueInputRefs.length > 0)
            ? field.defaultValueInputRefs
            : parseInputRefsFromValue(field.defaultValue as FieldValue);
        return buildInputTagValue(refs);
    }

    if (field.kind === 'select') {
        return normalizeSelectModeValue(field, field.defaultValue);
    }

    return field.defaultValue;
};

const collectVariantFields = (variant: ConfigVariant): ValueField[] => {
    const fields: ValueField[] = [];
    (variant.lines || []).forEach(line => {
        const lineFields = Array.isArray(line?.fields) ? line.fields : [];
        lineFields.forEach(field => {
            if (!field || typeof field !== 'object' || typeof (field as any).id !== 'string') return;
            if ((field as any).kind === 'input' || (field as any).kind === 'select') {
                fields.push(field as ValueField);
            }
        });
    });
    return fields;
};

export const buildInitialLineValues = (variant: ConfigVariant): Record<string, string | string[]> => {
    const fields = collectVariantFields(variant);
    const fieldMap = new Map(fields.filter(field => typeof field.id === 'string' && field.id.length > 0).map(field => [field.id, field]));
    const resolved = new Map<string, string | string[] | undefined>();
    const resolving = new Set<string>();

    const resolveByFieldId = (fieldId: string): FieldValue => {
        if (resolved.has(fieldId)) return resolved.get(fieldId);
        const field = fieldMap.get(fieldId);
        if (!field) return undefined;

        if (resolving.has(fieldId)) {
            return field.defaultValue as FieldValue;
        }

        resolving.add(fieldId);
        const value = resolveFieldDefaultValue(field, resolveByFieldId);
        resolving.delete(fieldId);
        resolved.set(fieldId, value);
        return value;
    };

    fields.forEach(field => {
        if (!field?.id) return;
        resolveByFieldId(field.id);
    });

    const initialValues: Record<string, string | string[]> = {};
    fields.forEach(field => {
        if (!field?.id) return;
        const value = resolved.get(field.id);
        if (value !== undefined) {
            initialValues[field.id] = value;
        }
    });

    return initialValues;
};

export const mergeLineValuesWithDefaults = (
    variant: ConfigVariant,
    lineValues: Record<string, string | string[]> | undefined,
): Record<string, string | string[]> => ({
    ...buildInitialLineValues(variant),
    ...(lineValues || {}),
});
