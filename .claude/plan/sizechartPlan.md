# SizeChart Implementation Plan

**Spec:** `.claude/spec/sizechartSpec.md`  
**Branch:** `sizechart`  
**Status:** Phase 1–3 complete — Phase 4 & 5 pending (manual testing)

---

## Current State (as of 2026-05-21)

| File | Status | Notes |
|---|---|---|
| `src/models/sizeChart.model.js` | ✅ Complete | `usageCount` field and `incrementUsageCount` method removed |
| `src/controller/sizeChart.controller.js` | ✅ Complete | `usageCount` removed from READ_ONLY_FIELDS |
| `src/routes/api/sizeChart.api.js` | ✅ Complete | Validation wired, permission slug fixed to `"size-chart"` |
| `src/validation/sizeChart.validation.js` | ✅ Complete | Joi schemas: create, update, fromTemplate |
| Permission slug alignment | ✅ Fixed | All authorize() calls use `"size-chart"` |

---

## Phase 1 — Core Infrastructure ✅ Done

All files exist and are wired together. Routes are registered in `src/routes/index.js` under `/sizechart`.

---

## Phase 2 — Validation Layer 🔲 Next

### Task 2.1 — Create `src/validation/sizeChart.validation.js`

**Why:** The controller currently passes `req.body` directly to `new SizeChart(body).save()`. Joi validation catches type/format errors before they hit Mongoose, returns consistent `400` messages.

**Pattern to follow:** `src/validation/variant.validation.js` (nested array validation with `expandBracketKeys`).

**Joi schema to implement:**

```js
const columnSchema = Joi.object({
  key:         Joi.string().trim().lowercase()
                 .pattern(/^[a-z0-9_]+$/).required()
                 .messages({ "string.pattern.base": "Column key must be lowercase alphanumeric with underscores only" }),
  label:       Joi.string().trim().required(),
  unit:        Joi.string().valid("inch","cm","mm","kg","lbs","ml","l","unitless").default("unitless"),
  order:       Joi.number().integer().min(0).default(0),
  description: Joi.string().trim().max(500).optional().allow(""),
});

const rowSchema = Joi.object({
  label:  Joi.string().trim().required(),
  values: Joi.array().items(Joi.string().allow("")).min(1).required(),
  order:  Joi.number().integer().min(0).default(0),
  sku:    Joi.string().trim().optional().allow(""),
});

const conversionRuleSchema = Joi.object({
  fromUnit: Joi.string().valid("inch","cm","mm","kg","lbs","ml","l").required(),
  toUnit:   Joi.string().valid("inch","cm","mm","kg","lbs","ml","l").required(),
  factor:   Joi.number().min(0).required(),
});

// Create / Update schema (all fields optional on update)
const createSizeChartSchema = Joi.object({
  name:            Joi.string().trim().max(100).required(),
  description:     Joi.string().trim().max(1000).optional().allow(""),
  applicableLevel: Joi.string()
                     .valid("category","subCategory","product","variant","brand")
                     .required(),
  applicableCategories:    Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableSubCategories: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableProducts:      Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableVariants:      Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableBrands:        Joi.array().items(Joi.string().hex().length(24)).default([]),
  columns:         Joi.array().items(columnSchema).min(1).max(10).required(),
  rows:            Joi.array().items(rowSchema).min(1).required(),
  measurementGuide:Joi.string().trim().max(1000).optional().allow(""),
  tips:            Joi.array().items(
                     Joi.object({ title: Joi.string().required(), description: Joi.string().required() })
                   ).optional(),
  videoUrl:        Joi.string().uri({ scheme: ["http","https"] }).optional().allow(""),
  supportedUnits:  Joi.array().items(
                     Joi.string().valid("inch","cm","mm","kg","lbs","ml","l")
                   ).optional(),
  conversionRules: Joi.array().items(conversionRuleSchema).optional(),
  isTemplateChart: Joi.boolean().default(false),
  visibility:      Joi.string().valid("public","internal","draft").default("draft"),
  displayOrder:    Joi.number().integer().min(0).default(0),
});

const updateSizeChartSchema = createSizeChartSchema.fork(
  ["name","applicableLevel","columns","rows"],
  (field) => field.optional()
);

const fromTemplateSchema = Joi.object({
  templateId:              Joi.string().hex().length(24).required(),
  name:                    Joi.string().trim().max(100).required(),
  applicableLevel:         Joi.string().valid("category","subCategory","product","variant","brand").optional(),
  applicableCategories:    Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableSubCategories: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableProducts:      Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableVariants:      Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableBrands:        Joi.array().items(Joi.string().hex().length(24)).default([]),
  description:             Joi.string().trim().max(1000).optional().allow(""),
  visibility:              Joi.string().valid("public","internal","draft").default("draft"),
});
```

**Export:**

```js
module.exports = { createSizeChartSchema, updateSizeChartSchema, fromTemplateSchema };
```

---

### Task 2.2 — Wire Validation into Controller

Apply `validate(schema)` middleware in the **route file** (not in the controller):

```js
// sizeChart.api.js
const validate = require("../../middleware/validate");
const {
  createSizeChartSchema,
  updateSizeChartSchema,
  fromTemplateSchema,
} = require("../../validation/sizeChart.validation");

_.route("/create-sizechart").post(
  // authGuard, authorize("size-chart", "add"),
  validate(createSizeChartSchema),
  sizeChartController.createSizeChart,
);

_.route("/update-sizechart/:slug").put(
  // authGuard, authorize("size-chart", "update"),
  validate(updateSizeChartSchema),
  sizeChartController.updateSizeChart,
);

_.route("/from-template").post(
  // authGuard, authorize("size-chart", "add"),
  validate(fromTemplateSchema),
  sizeChartController.createFromTemplate,
);
```

---

## Phase 3 — Permission Slug Fix 🔲 Pending

### Task 3.1 — Identify the mismatch

The permission seeder registers `"Size Chart"` → slug becomes `"size-chart"` (slugify strict mode).  
The controller auth comment uses `authorize("sizechart", ...)` → looks for slug `"sizechart"`.

These will not match. The `authorize` middleware checks:
```js
perm.permission.slug === moduleName?.toString()?.toLowerCase()
```

`"size-chart" !== "sizechart"` → all authorized requests will be denied.

### Task 3.2 — Fix

**Option A (recommended):** Change the authorize calls in the route file to use the correct slug:
```js
// Before (wrong)
authorize("sizechart", "add")

// After (correct — matches seeded slug)
authorize("size-chart", "add")
```

**Option B:** Add a new seeder entry with slug `"sizechart"`. Requires re-running `npm run seed:permissions`.

Go with Option A — no DB changes needed.

**Files to update:** `src/routes/api/sizeChart.api.js` — change all `"sizechart"` → `"size-chart"` in authorize calls.

---

## Phase 4 — Manual Testing Checklist 🔲 Pending

Once Phase 2 & 3 are done, verify each endpoint:

### 4.1 Create

```bash
POST /api/v1/sizechart/create-sizechart
```

| Test | Expected |
|---|---|
| Valid body with 3 columns and 3 matching rows | `201` — document returned with auto slug, sizeLabels, minSize, maxSize |
| Missing `name` | `400` — Joi: "name is required" |
| Missing `applicableLevel` | `400` — Joi: "applicableLevel is required" |
| `applicableLevel: "category"` with empty `applicableCategories` and `isTemplateChart: false` | `400` — pre-save: "At least one applicable category is required" |
| `applicableLevel: "category"` with empty arrays and `isTemplateChart: true` | `201` — template charts exempt |
| `columns: []` (empty) | `400` — Joi min(1) |
| `columns` length > 10 | `400` — Joi max(10) |
| `row.values` count < columns count | `400` — pre-save hook |
| `column.key: "My Column"` (space + uppercase) | `400` — Joi regex |
| `column.key: "my_column"` | `201` |
| `videoUrl: "not-a-url"` | `400` — Joi uri |
| Duplicate `name` (same as existing chart) | `400` — pre-save slug collision |

### 4.2 Get All

```bash
GET /api/v1/sizechart/get-sizechart
GET /api/v1/sizechart/get-sizechart?applicableLevel=category
GET /api/v1/sizechart/get-sizechart?isActive=false
GET /api/v1/sizechart/get-sizechart?isTemplateChart=true
GET /api/v1/sizechart/get-sizechart?visibility=public
```

| Test | Expected |
|---|---|
| No filter — first call | `200`, `fromCache: false`, all charts |
| No filter — second call | `200`, `fromCache: true` |
| `?applicableLevel=category` | Only category-scoped charts |
| `?isActive=false` | Only inactive charts |
| No charts in DB | `200`, `sizeCharts: []`, `total: 0`, `fromCache: false` |

### 4.3 Get Single

```bash
GET /api/v1/sizechart/get-sizechart/:slug
```

| Test | Expected |
|---|---|
| Valid slug — first call | `200`, `fromCache: false`, `viewCount` unchanged in response (incremented async) |
| Valid slug — second call | `200`, `fromCache: true` |
| Non-existent slug | `200`, `sizeChart: null`, `fromCache: false` |
| After two fetch calls | DB `viewCount` incremented by 2 |

### 4.4 Update

```bash
PUT /api/v1/sizechart/update-sizechart/:slug
```

| Test | Expected |
|---|---|
| Change `name` → new unique name | `200`, `slug` regenerated in response |
| Change `name` → name of another existing chart | `400` — slug collision |
| Send `slug` in body | Ignored — stripped by `READ_ONLY_FIELDS` |
| Send `viewCount: 999` in body | Ignored |
| Update `columns` — add a column but keep old rows (values mismatch) | `400` — pre-save hook |
| Update `columns` and `rows` together with matching lengths | `200` |

### 4.5 Activate / Deactivate

```bash
PUT /api/v1/sizechart/update-sizechart/:slug/deactivate
PUT /api/v1/sizechart/update-sizechart/:slug/activate
```

| Test | Expected |
|---|---|
| Deactivate active chart | `200`, `isActive: false` |
| `GET /applicable` after deactivate | Chart excluded |
| Activate → `GET /applicable` | Chart included again |
| Non-existent slug | `404` |

### 4.6 Delete

```bash
DELETE /api/v1/sizechart/delete-sizechart/:slug
```

| Test | Expected |
|---|---|
| Valid slug | `200`, `data: null` |
| Same slug again | `404` |
| Chart with `childCharts` | `200` — children keep their `parentChartId` |

### 4.7 Create from Template

```bash
POST /api/v1/sizechart/from-template
```

| Test | Expected |
|---|---|
| Valid `templateId` (isTemplateChart: true) | `201` — inherits columns/rows, `parentChartId` set |
| `templateId` of non-template chart | `400` |
| Non-existent `templateId` | `400` |
| Missing `name` | `400` — Joi |
| Template's `childCharts` after creation | Contains new chart's `_id` |

### 4.8 Applicable Charts

```bash
GET /api/v1/sizechart/applicable?categoryId=<ObjectId>
GET /api/v1/sizechart/applicable?productId=<ObjectId>
```

| Test | Expected |
|---|---|
| No filter params | `400` — "At least one filter param is required" |
| Valid `categoryId` | `200` — charts with `applicableLevel: "category"` and matching `applicableCategories` |
| Draft chart matches filter | Excluded (`visibility ≠ draft`) |
| Inactive chart matches filter | Excluded (`isActive: false`) |
| Second identical request | `fromCache: true` |

### 4.9 Search

```bash
GET /api/v1/sizechart/search-sizechart?query=shirt
GET /api/v1/sizechart/search-sizechart?query=category
```

| Test | Expected |
|---|---|
| `?query=shirt` | Charts with "shirt" in name (case-insensitive) |
| `?query=category` | Charts with "category" in name + charts with `applicableLevel: "category"` |
| `?query=` (empty) | `400` — "query param is required" |
| No matches | `200`, `sizeCharts: []`, `total: 0`, `fromCache: false` |
| Second identical query | `fromCache: true` |

---

## Phase 5 — Cache Invalidation Verification 🔲 Pending

After each write operation (create, update, delete, activate, deactivate), verify:

1. Call list → `fromCache: false` (cache bumped by `bumpNsVersion`)
2. Call same list again → `fromCache: true`
3. Perform a write → call list → `fromCache: false` again

---

## Task Summary

| # | Task | Phase | Status | File |
|---|---|---|---|---|
| T-01 | Model — complete | 1 | ✅ Done | `src/models/sizeChart.model.js` |
| T-02 | Controller — rewrite | 1 | ✅ Done | `src/controller/sizeChart.controller.js` |
| T-03 | Routes — fix params & add routes | 1 | ✅ Done | `src/routes/api/sizeChart.api.js` |
| T-04 | Joi validation schema | 2 | ✅ Done | `src/validation/sizeChart.validation.js` |
| T-05 | Wire validate middleware into routes | 2 | ✅ Done | `src/routes/api/sizeChart.api.js` |
| T-06 | Fix permission slug `"sizechart"` → `"size-chart"` | 3 | ✅ Done | `src/routes/api/sizeChart.api.js` |
| T-07 | Manual testing — all 9 endpoints | 4 | 🔲 Pending | — |
| T-08 | Cache invalidation verification | 5 | 🔲 Pending | — |

---

## Dependency Order

```
T-01 (model) ──► T-02 (controller) ──► T-03 (routes)
                                           │
               T-04 (Joi schema) ─────────► T-05 (wire into routes) ──► T-06 (slug fix)
                                                                              │
                                                              T-07 (testing) ─► T-08 (cache check)
```

---

## Files to Create

| File | Action |
|---|---|
| `src/validation/sizeChart.validation.js` | **Create** |

## Files to Modify

| File | Change |
|---|---|
| `src/routes/api/sizeChart.api.js` | Add `validate()` middleware + fix permission slug |
| `.claude/spec/sizechartSpec.md` | Update header — controller rewrite is done |
