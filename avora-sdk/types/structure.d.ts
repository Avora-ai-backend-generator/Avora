/** Public visual node structure; shared by the editor and starter-case planner. */
export interface RequestKeyValuePair {
    id: string;
    key: string;
    value: string;
    type?: string;
    typePointerFieldId?: string;
    typeMode?: 'dynamic';
    optional?: boolean; // Hidden by default; can be added from node suggestions
    isEnabled: boolean;
    isRequired?: boolean; // For fixed, non-editable inputs and outputs
    info?: string; // Tooltip info text for required inputs and outputs
    isPredefined?: boolean; // True if declared in the node builder
}
export type ConstraintTypeValue = 'any' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'sameAsField';

// ─── Field Types (discriminated union) ───
export type FieldType = 'text' | 'number' | 'datetime' | 'boolean' | 'string';

export type DefaultValueMode = 'custom' | 'field' | 'suggestion' | 'env' | 'input';

export interface DefaultValueBinding {
    defaultValueMode?: DefaultValueMode;
    defaultValueFieldId?: string;
    defaultValueEnvKey?: string;
    defaultValueInputRefs?: string[];
}

export interface InputField extends DefaultValueBinding {
    kind: 'input';
    id: string;
    label: string;
    fieldType: FieldType;  // controls widget: number→counter, boolean→switch, datetime→picker, text/string→textbox
    defaultValue?: string;
    placeholder?: string;
    typeConstraint?: TypeConstraint;
}

export type ConstraintType = ConstraintTypeValue;

export interface TypeConstraint {
    type: ConstraintType;
    relatedFieldId?: string; // For 'sameAsField'
    required?: boolean; // If true, error; if false, warning (or ignored if empty)
}

export interface SelectOption {
    value: string;
    label: string;
    // When this option is selected, override other fields in the SAME line
    overrideFields?: Record<string, Partial<InputField | SelectField>>;
    // When this option is selected, hide these field IDs from the line
    hideFields?: string[];
    // When this option is selected, add these extra fields to the line
    addFields?: ConfigField[];
    // When this option is selected, override the node-level elements using a predefined pack ID
    overridePackId?: string;
    // Granular element overrides (inputs/outputs/logicFlows)
    overrideElements?: Partial<NodeElements>;
}

export interface SelectField extends DefaultValueBinding {
    kind: 'select';
    id: string;
    label: string;
    options: SelectOption[];
    canCustom: boolean;  // allow free-text entry
    multiSelect?: boolean; // allow selecting multiple options
    defaultValue?: string | string[];
    source?: 'static' | 'objects' | 'attributes' | 'conditions';         // 'objects' = classes, 'attributes' = class attributes, 'conditions' = operators
    relatedToField?: string;               // For 'objects': filter related. For 'attributes': field picking the object. For 'conditions': field to filter operators by.
    conditionFilterType?: ConstraintType | 'any'; // If source is 'conditions', manual type filter
    allowedRelationTypes?: string[];        // Filter edges by type (e.g. ['association', 'composition'])
    allowedMultiplicities?: string[];       // Filter edges by multiplicity (e.g. ['1:*', '*:*'])
    overridePackId?: string; // When any value is selected, override node elements using a predefined pack ID
}

export interface TextField {
    kind: 'text';        // static display label (e.g. "To" in conversions)
    id: string;
    content: string;
}

export type ConfigField = InputField | SelectField | TextField;
export type ValueField = InputField | SelectField;


// ─── Config Line ───
export interface ConfigLineCondition {
    fieldId: string;
    operator: 'equals' | 'notEquals';
    value: string;
}

// ─── Generic Object Line ───
// Used to auto-generate one config row per attribute of a selected workspace class.
export interface AttributeLineOverride {
    label?: string;                          // Custom display label for the attribute
    fieldType?: 'string' | 'number' | 'boolean' | 'datetime'; // Force a specific widget
    options?: string;                        // Comma-separated values → renders as select dropdown
    hide?: boolean;                          // Exclude this attribute entirely
}

export interface GenericObjectConfig {
    perAttributeOverrides?: Record<string, AttributeLineOverride>; // keyed by attribute name
    defaultFieldType?: 'string' | 'number' | 'boolean';           // fallback widget type
    includeInheritedAttributes?: boolean;  // walk up inheritance chain (default true)
    includeRelations?: boolean;            // generate sub-lines for related entities (default true)
    allowedRelationTypes?: string[];       // Filter edges by type (e.g. ['association', 'composition', 'inheritance'])
    relationAttributeStyle?: 'id' | 'fields'; // how relations are represented in the generated fields
    relationOverrides?: Record<string, RelationLineOverride>; // keyed by related class name
}

// Relation-driven line configuration
export type RelationMode = 'inline' | 'list' | 'select' | 'connect';

export interface RelationLineOverride {
    hide?: boolean;               // Exclude this relation entirely
    mode?: RelationMode;          // Force a specific rendering mode
    label?: string;               // Custom label for the relation line
    maxItems?: number;            // For list mode, cap items
    createWithParent?: boolean;   // For composition: create child when parent is created
}

export interface ConfigLineInstance {
    instanceId: string;
    id: string;
    label?: string;      // optional row label
    iconName?: string;
    description?: string;
    fields: ConfigField[];
    lineType: 'required' | 'optional' | 'optional-multiple' | 'generic-object';
    max?: number;        // max instances (only for optional-multiple)
    displayConditions?: ConfigLineCondition[];
    appendPackId?: string;
    appendElements?: Partial<NodeElements>;
    genericObjectConfig?: GenericObjectConfig;
}

export interface ConfigLine extends Omit<ConfigLineInstance, 'instanceId'> {
    // 'required'          – auto-added with config; deleting resets entire variant
    // 'optional'          – shown by default; deletable, restorable from suggestions
    // 'optional-multiple' – always in suggestion menu; each click adds a new instance
    // 'generic-object'    – reads the selected class attributes and generates one row each
    instances?: ConfigLineInstance[];
}

// ─── Node Elements (I/O, logic flows, errors) ───
export interface NodeIOSection {
    title: string;
    canAdd: boolean;
    defaults: Partial<RequestKeyValuePair>[];
}

export interface LogicFlowDefinition {
    id: string;
    title: string;
    editable?: boolean;
    optional?: boolean; // If true, appears in suggestion menu instead of auto-adding
    info?: string;
}

export interface ErrorDefinition {
    id: string;
    message: string;
    status?: string | number;
    optional?: boolean; // If true, hidden initially and addable from suggestions
    info?: string;
}

export interface NodeElements {
    inputs: NodeIOSection;
    outputs: NodeIOSection;
    config?: NodeIOSection; // Keep config for backward compatibility if needed, or for other generic settings
    logicFlows?: LogicFlowDefinition[];
    errors?: ErrorDefinition[]; // List of potential errors can be useful
}

export interface SuggestionDef {
    label: string;
    description?: string;
    addInputs?: Partial<RequestKeyValuePair>[];
    addOutputs?: Partial<RequestKeyValuePair>[];
    addLogicFlows?: LogicFlowDefinition[];
}

export interface ElementPackInstance {
    instanceId: string;
    id: string;
    title?: string;
    elements: Partial<NodeElements>;
}

// ─── Element Pack ───
export interface ElementPack {
    id: string;      // e.g. 'base', 'pack_1'
    title: string;   // e.g. "Base Elements", "Auth Required Outputs"
    elements: Partial<NodeElements>;
    instances?: ElementPackInstance[];
}

// ─── Unified Condition System ───
// A ConditionRule pairs a WHEN clause (field=value) with THEN behaviors (show/hide/override).
// This replaces the old scattered: displayConditions, hideFields, overrideFields,
// addFields, overridePackId (on SelectOption), appendPackId (on ConfigLine).

export type ConditionOperator = 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'isAppearing' | 'isNotAppearing' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'isIn';

export type ConditionBehavior =
    | { actionType: 'line'; changeType: 'show' | 'hide' | 'append'; lineId: string; attributeName?: string }
    | { actionType: 'line'; changeType: 'instance'; lineId: string; instanceId: string; attributeName?: string }
    | { actionType: 'element'; changeType: 'show' | 'hide' | 'append'; packId: string; lineId?: string }
    | { actionType: 'element'; changeType: 'instance'; packId: string; instanceId: string; lineId?: string }
    | { actionType: 'genericAttribute'; changeType: 'show' | 'hide'; lineId?: string }
    | { actionType: 'genericAttribute'; changeType: 'override'; overrideLineId: string; lineId?: string };

export type ConditionTargetType = 'field' | 'line' | 'genericAttribute' | 'element';

export interface ConditionTarget {
    type: ConditionTargetType;
    fieldId?: string;       // for 'field'
    lineId?: string;        // for 'line' or 'genericAttribute'
    packId?: string;        // for 'element' (related behaviors)
    attributeName?: string; // for 'genericAttribute' or fine-grained targeting
}

export interface SubCondition {
    type: 'condition';
    id: string;
    customLabel?: string;
    target: ConditionTarget;
    operator: ConditionOperator;
    valueSource?: 'custom' | 'field';
    valueFieldId?: string;
    value: string | string[];
}

export interface ConditionGroup {
    type: 'group';
    id: string;
    logicalOperator: 'AND' | 'OR';
    conditions: (SubCondition | ConditionGroup)[];
}

export interface ConditionRule {
    id: string;
    label: string;
    condition: ConditionGroup; // Root group
    behaviors: ConditionBehavior[];
}

// ─── Config Variant ───
export interface ConfigVariant {
    id: string;
    title: string; // Template name (e.g., "One Condition", "Multiple Conditions")
    description?: string;
    lines: ConfigLine[];
    elements: NodeElements;   // DEFAULT base elements for backward compatibility
    basePackTitle?: string; // custom title for the base elements pack
    instances?: ElementPackInstance[]; // instances for the base elements
    elementPacks?: ElementPack[]; // Dictionary/List of predefined element packs that can be referenced
    conditions?: ConditionRule[]; // Unified condition rules (replaces old scattered condition props in UI)
    onError?: {
        continueByDefault: boolean;
    };
    suggestions?: SuggestionDef[];
}

// ─── Code Builder Types ───
export interface CodeZone {
    id: string;
    label: string;         // e.g. "Inputs Processing", "Main Logic"
    linkedTo?: 'inputs' | 'outputs' | 'logicFlows' | 'errors' | 'custom';
    code: string;          // raw template code with mustache-like placeholders
}

export interface CodeSnippet {
    id: string;
    label: string;
    color?: string;
    linkedTo?: 'inputs' | 'outputs' | 'logicFlows' | 'errors' | 'custom';
    code: string;
    collapsed?: boolean;
}

export interface VariantCodeTemplate {
    variantId: string;
    header: string;
    code: string;
    snippets: CodeSnippet[];
}

export interface FrameworkDependency {
    id: string;
    name: string;
    version?: string;
    importLine: string;
}

export interface FrameworkCodeTemplate {
    frameworkId: string;   // 'fastapi' | 'express' | 'spring' | 'django'
    language: string;      // 'python' | 'javascript' | 'java'
    baseTemplate: string;  // the full file template (read-only scaffold)
    zones: CodeZone[];     // legacy editable zones (kept for backward compatibility)
    variants?: Record<string, VariantCodeTemplate>;
    customImports?: string;
    dependencies?: FrameworkDependency[];
}

export type NodeCodeBundle = Record<string, FrameworkCodeTemplate>;

// ─── Top-level Node Config ───
export interface ActionNodeStructure {
    logo?: { light: {path: string; data?: string}; dark?: {path: string; data?: string} };
    colorSource?: "logo" | "manual";
    label: string;
    icon: string;
    color: string;
    description: string;
    category: 'Control Flow' | 'Data' | 'Integration' | 'Security' | 'Other';
    variants: ConfigVariant[];
}

// Backward-compatible alias used across the current codebase.
export interface ActionNodeConfig extends ActionNodeStructure {}
