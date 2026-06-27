import "server-only";

import { isBlockedCanonicalPath, SEO_CANONICAL_MAX_LENGTH } from "@/src/lib/seo/seo-canonical-runtime";
import { normalizeSeoLanguage, SEO_LANGUAGE_MAX_LENGTH } from "@/src/lib/seo/seo-language-runtime";
import { SEO_META_DESCRIPTION_MAX_LENGTH } from "@/src/lib/seo/seo-meta-description-runtime";
import { SEO_META_TITLE_MAX_LENGTH } from "@/src/lib/seo/seo-meta-title-runtime";

export type SeoEditorFieldId =
  | "canonicalPath"
  | "language"
  | "metaDescription"
  | "metaTitle"
  | "openGraphEnabled";

export type SeoEditorFieldType = "boolean" | "language" | "path" | "text";

export type SeoEditorFieldSource = "seo_editor_runtime";

export type SeoEditorRuntimeStatus = "editor_ready" | "invalid" | "placeholder";

export type SeoEditableField = {
  description: string;
  enabled: true;
  id: SeoEditorFieldId;
  implemented: false;
  label: string;
  source: SeoEditorFieldSource;
  type: SeoEditorFieldType;
  validationRules: string[];
};

export type SeoEditorFieldValidation = {
  fieldId: SeoEditorFieldId | "unknown";
  isValid: boolean;
  issues: string[];
  normalizedValue: boolean | string | null;
};

export type SeoEditorSummary = {
  readOnly: true;
  runtimeStatus: SeoEditorRuntimeStatus;
  summary: string;
};

export type SeoEditorRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_EDITOR_HOOK_LABEL = "SEO editor" as const;
export const SEO_EDITOR_SOURCE = "seo_editor_runtime" as const;

const SAFE_LANGUAGE_CODES = ["ar", "en", "fr"] as const;

const PRIVATE_CANONICAL_ROUTE_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

const SEO_EDITABLE_FIELD_DEFINITIONS: readonly SeoEditableField[] = [
  {
    description: "Future platform meta title editor field. Validation-only in this phase.",
    enabled: true,
    id: "metaTitle",
    implemented: false,
    label: "Meta title",
    source: SEO_EDITOR_SOURCE,
    type: "text",
    validationRules: [
      "required",
      `max_length:${SEO_META_TITLE_MAX_LENGTH}`,
      "no_empty"
    ]
  },
  {
    description: "Future platform meta description editor field. Validation-only in this phase.",
    enabled: true,
    id: "metaDescription",
    implemented: false,
    label: "Meta description",
    source: SEO_EDITOR_SOURCE,
    type: "text",
    validationRules: [
      "required",
      `max_length:${SEO_META_DESCRIPTION_MAX_LENGTH}`,
      "no_empty"
    ]
  },
  {
    description: "Future canonical path editor field. Validation-only in this phase.",
    enabled: true,
    id: "canonicalPath",
    implemented: false,
    label: "Canonical path",
    source: SEO_EDITOR_SOURCE,
    type: "path",
    validationRules: [
      "required",
      "starts_with_slash",
      "blocked_admin_api_dashboard",
      "blocked_private_routes",
      `max_length:${SEO_CANONICAL_MAX_LENGTH}`
    ]
  },
  {
    description: "Future Open Graph toggle editor field. Validation-only in this phase.",
    enabled: true,
    id: "openGraphEnabled",
    implemented: false,
    label: "Open Graph enabled",
    source: SEO_EDITOR_SOURCE,
    type: "boolean",
    validationRules: ["boolean_only"]
  },
  {
    description: "Future language editor field. Validation-only in this phase.",
    enabled: true,
    id: "language",
    implemented: false,
    label: "Language",
    source: SEO_EDITOR_SOURCE,
    type: "language",
    validationRules: [
      "required",
      "safe_language_code",
      `max_length:${SEO_LANGUAGE_MAX_LENGTH}`
    ]
  }
] as const;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isPrivateCanonicalRoute(path: string) {
  const normalized = path.toLowerCase();
  return PRIVATE_CANONICAL_ROUTE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().toLowerCase();

    if (cleaned === "true") {
      return true;
    }

    if (cleaned === "false") {
      return false;
    }
  }

  return null;
}

function validateMetaTitleValue(value: unknown): SeoEditorFieldValidation {
  const cleaned = text(value, SEO_META_TITLE_MAX_LENGTH);
  const issues: string[] = [];

  if (!cleaned) {
    issues.push("Meta title cannot be empty.");
  }

  return {
    fieldId: "metaTitle",
    isValid: issues.length === 0,
    issues,
    normalizedValue: cleaned || null
  };
}

function validateMetaDescriptionValue(value: unknown): SeoEditorFieldValidation {
  const cleaned = text(value, SEO_META_DESCRIPTION_MAX_LENGTH);
  const issues: string[] = [];

  if (!cleaned) {
    issues.push("Meta description cannot be empty.");
  }

  return {
    fieldId: "metaDescription",
    isValid: issues.length === 0,
    issues,
    normalizedValue: cleaned || null
  };
}

function validateCanonicalPathValue(value: unknown): SeoEditorFieldValidation {
  const cleaned = text(value, SEO_CANONICAL_MAX_LENGTH);
  const issues: string[] = [];

  if (!cleaned) {
    issues.push("Canonical path cannot be empty.");
  } else if (!cleaned.startsWith("/")) {
    issues.push('Canonical path must start with "/".');
  } else if (isBlockedCanonicalPath(cleaned)) {
    issues.push("Canonical path cannot use admin, api, or dashboard routes.");
  } else if (isPrivateCanonicalRoute(cleaned)) {
    issues.push("Canonical path cannot use private tenant or account routes.");
  }

  return {
    fieldId: "canonicalPath",
    isValid: issues.length === 0,
    issues,
    normalizedValue: cleaned || null
  };
}

function validateOpenGraphEnabledValue(value: unknown): SeoEditorFieldValidation {
  const parsed = parseBooleanValue(value);
  const issues: string[] = [];

  if (parsed === null) {
    issues.push("Open Graph enabled must be a boolean value.");
  }

  return {
    fieldId: "openGraphEnabled",
    isValid: issues.length === 0,
    issues,
    normalizedValue: parsed
  };
}

function validateLanguageValue(value: unknown): SeoEditorFieldValidation {
  const cleaned = text(value, SEO_LANGUAGE_MAX_LENGTH);
  const issues: string[] = [];

  if (!cleaned) {
    return {
      fieldId: "language",
      isValid: false,
      issues: ["Language cannot be empty."],
      normalizedValue: null
    };
  }

  const normalized = normalizeSeoLanguage(cleaned);

  if (!SAFE_LANGUAGE_CODES.includes(normalized as (typeof SAFE_LANGUAGE_CODES)[number])) {
    issues.push("Language must use a safe platform language code (en, fr, ar).");
  }

  return {
    fieldId: "language",
    isValid: issues.length === 0,
    issues,
    normalizedValue: normalized
  };
}

export function getSeoEditableFields(): SeoEditableField[] {
  return SEO_EDITABLE_FIELD_DEFINITIONS.map((field) => ({ ...field }));
}

export function getSeoEditableFieldById(fieldId: string): SeoEditableField | null {
  return getSeoEditableFields().find((field) => field.id === fieldId) ?? null;
}

export function validateSeoEditorField(fieldId: string, value: unknown): SeoEditorFieldValidation {
  switch (fieldId) {
    case "metaTitle":
      return validateMetaTitleValue(value);
    case "metaDescription":
      return validateMetaDescriptionValue(value);
    case "canonicalPath":
      return validateCanonicalPathValue(value);
    case "openGraphEnabled":
      return validateOpenGraphEnabledValue(value);
    case "language":
      return validateLanguageValue(value);
    default:
      return {
        fieldId: "unknown",
        isValid: false,
        issues: ["Unknown SEO editor field id."],
        normalizedValue: null
      };
  }
}

export function validateSeoEditorRuntime(fields: SeoEditableField[] = getSeoEditableFields()): SeoEditorRuntimeValidation {
  const issues: string[] = [];

  if (fields.length !== SEO_EDITABLE_FIELD_DEFINITIONS.length) {
    issues.push("SEO editor runtime must declare all safe editable fields.");
  }

  for (const field of fields) {
    if (field.source !== SEO_EDITOR_SOURCE) {
      issues.push("SEO editor fields must originate from the editor runtime.");
      break;
    }

    if (field.enabled !== true) {
      issues.push("SEO editor fields must remain enabled for future readiness only.");
      break;
    }

    if (field.implemented !== false) {
      issues.push("SEO editor fields must remain unimplemented in this phase.");
      break;
    }

    if (!field.validationRules.length) {
      issues.push("SEO editor fields must declare validation rules.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getSeoEditorRuntimeStatus(fields: SeoEditableField[] = getSeoEditableFields()): SeoEditorRuntimeStatus {
  const validation = validateSeoEditorRuntime(fields);

  if (!validation.isValid) {
    return "invalid";
  }

  if (fields.some((field) => !field.implemented)) {
    return "placeholder";
  }

  return "editor_ready";
}

export function getSeoEditorSummary(fields: SeoEditableField[] = getSeoEditableFields()): SeoEditorSummary {
  const runtimeStatus = getSeoEditorRuntimeStatus(fields);
  const implementedCount = fields.filter((field) => field.implemented).length;

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `${fields.length} editable field(s)`,
      `${implementedCount} implemented`,
      `${fields.length - implementedCount} validation-only`,
      "no save or persistence"
    ].join("; ")
  };
}

export function mapSeoEditorRuntimeToAdminFields() {
  const fields = getSeoEditableFields();
  const validation = validateSeoEditorRuntime(fields);
  const editorSummary = getSeoEditorSummary(fields);

  return {
    editableFields: fields.map((field) => ({
      description: field.description,
      enabled: field.enabled,
      id: field.id,
      implemented: field.implemented,
      label: field.label,
      type: field.type,
      validationRules: field.validationRules
    })),
    hookLabel: SEO_EDITOR_HOOK_LABEL,
    readOnly: true,
    runtimeStatus: validation.isValid ? editorSummary.runtimeStatus : "placeholder",
    summary: validation.isValid
      ? editorSummary.summary
      : "SEO editor runtime validation requires safe read-only defaults."
  };
}

// SEO-25+ placeholders: save actions, persistence, and AI generation stay disconnected.
export const SEO_EDITOR_FUTURE_HOOKS = ["seo_editor_save", "seo_editor_persistence", "seo_ai_generator"] as const;
