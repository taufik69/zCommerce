# SizeChart API Specification

**Model:** `src/models/sizeChart.model.js`  
**Controller:** `src/controller/sizeChart.controller.js` ← needs full rewrite  
**Route file:** `src/routes/api/sizeChart.api.js`  
**Mount prefix:** `/sizechart` (registered in `src/routes/index.js`)

> **Current state:** The controller is completely misaligned with the model. It still
> references an old `subCategory` + `image` schema. The entire controller must be
> rewritten to match the model described here.

---

## 1. Functional Requirements

| #     | Requirement                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Admin can create a size chart with a column/row data table                                                                                                                            |
| FR-02 | Admin can mark a chart as a reusable template (`isTemplateChart: true`) — template charts skip the `applicableLevel` reference requirement                                            |
| FR-03 | Admin can create a new chart from an existing template (inherits columns, rows, conversionRules)                                                                                      |
| FR-04 | Admin can list all charts with optional filters: `applicableLevel`, `visibility`, `isActive`, `isTemplateChart`                                                                       |
| FR-05 | Admin can fetch a single chart by slug                                                                                                                                                |
| FR-06 | Admin can update any field of a chart                                                                                                                                                 |
| FR-07 | Admin can delete a chart (hard delete)                                                                                                                                                |
| FR-08 | Admin can activate / deactivate a chart                                                                                                                                               |
| FR-09 | Storefront can query applicable charts by `categoryId`, `subCategoryId`, `productId`, `variantId`, or `brandId` — returns only `isActive: true, visibility: { $ne: "draft" }` records |
| FR-10 | `viewCount` increments atomically each time the storefront fetches a chart                                                                                                            |
| FR-11 | `usageCount` increments when a product or variant is linked to this chart                                                                                                             |
| FR-12 | `sizeLabels`, `minSize`, `maxSize` are auto-derived from `rows` on every save — never accepted as input                                                                               |
| FR-13 | Columns and rows are automatically sorted by their `order` field on save                                                                                                              |
| FR-14 | `slug` is auto-generated from `name` on save — not accepted as input                                                                                                                  |

---

## 2. API Routes

Follow `ApiConvention.md`. All paths are relative to the `/sizechart` mount prefix.

```
POST   /create-sizechart                → FR-01, FR-02
GET    /get-sizechart                   → FR-04
GET    /get-sizechart/:slug             → FR-05, FR-10
PUT    /update-sizechart/:slug          → FR-06
DELETE /delete-sizechart/:slug          → FR-07
PUT    /update-sizechart/:slug/activate     → FR-08
PUT    /update-sizechart/:slug/deactivate   → FR-08
POST   /from-template                   → FR-03
GET    /applicable                      → FR-09
GET   /search-sizechart?query=value
query value will be category name subcategory brand variant product
```

> Current route file uses `:subCategory` and `:subcid` as params — both must be
> changed to `:slug`.

**Auth guards (commented-in when RBAC is enabled):**

```js
// authGuard, authorize("sizechart", "add")     → create, from-template
// authGuard, authorize("sizechart", "view")    → getAll, getSingle, applicable
// authGuard, authorize("sizechart", "update")  → update, activate, deactivate
// authGuard, authorize("sizechart", "delete")  → delete
```

---

## 3. Request Payloads

### 3.1 Create (`POST /create-sizechart`)

```json
{
  "name": "Men's T-Shirt Size Guide",
  "description": "Standard international sizing for men's t-shirts",

  "applicableLevel": "category",
  "applicableCategories": ["64f1a2b3c4d5e6f7a8b9c0d1"],

  "columns": [
    {
      "key": "chest",
      "label": "Chest",
      "unit": "inch",
      "order": 0,
      "description": "Measure at widest point"
    },
    { "key": "waist", "label": "Waist", "unit": "inch", "order": 1 },
    { "key": "length", "label": "Length", "unit": "inch", "order": 2 }
  ],
  "rows": [
    { "label": "S", "values": ["36", "30", "27"], "order": 0 },
    { "label": "M", "values": ["38", "32", "28"], "order": 1 },
    { "label": "L", "values": ["40", "34", "29"], "order": 2 },
    { "label": "XL", "values": ["42", "36", "30"], "order": 3 },
    { "label": "XXL", "values": ["44", "38", "31"], "order": 4 }
  ],

  "measurementGuide": "Keep the tape measure snug but not tight.",
  "tips": [
    { "title": "Chest", "description": "Measure at the fullest part." },
    { "title": "Waist", "description": "Measure at the narrowest point." }
  ],
  "videoUrl": "https://www.youtube.com/watch?v=example",

  "supportedUnits": ["inch", "cm"],
  "conversionRules": [
    { "fromUnit": "inch", "toUnit": "cm", "factor": 2.54 },
    { "fromUnit": "cm", "toUnit": "inch", "factor": 0.3937 }
  ],

  "isTemplateChart": false,
  "visibility": "public",
  "displayOrder": 0
}
```

**`applicableLevel` → required reference field mapping:**

| `applicableLevel` | Required array field                    |
| ----------------- | --------------------------------------- |
| `"category"`      | `applicableCategories` (≥1 ObjectId)    |
| `"subCategory"`   | `applicableSubCategories` (≥1 ObjectId) |
| `"product"`       | `applicableProducts` (≥1 ObjectId)      |
| `"variant"`       | `applicableVariants` (≥1 ObjectId)      |
| `"brand"`         | `applicableBrands` (≥1 ObjectId)        |

> Exception: when `isTemplateChart: true`, all applicable arrays may be empty.

---

### 3.2 Update (`PUT /update-sizechart/:slug`)

Same shape as create. All fields are optional except `name` triggers slug regeneration.  
`sizeLabels`, `minSize`, `maxSize`, `slug`, `viewCount`, `usageCount` are ignored even if sent.

---

### 3.3 Create from Template (`POST /from-template`)

```json
{
  "templateId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Women's T-Shirt Size Guide",
  "applicableLevel": "category",
  "applicableCategories": ["64f1a2b3c4d5e6f7a8b9c0e2"],
  "visibility": "draft",
  "description": "Derived from men's template"
}
```

Inherited from template (not overridable via this endpoint): `columns`, `rows`, `conversionRules`, `supportedUnits`.  
`parentChartId` is set automatically to `templateId`.

---

### 3.4 Get Applicable Charts (`GET /applicable`)

Query params only — no body:

```
GET /sizechart/applicable?categoryId=<ObjectId>
GET /sizechart/applicable?subCategoryId=<ObjectId>
GET /sizechart/applicable?productId=<ObjectId>
GET /sizechart/applicable?variantId=<ObjectId>
GET /sizechart/applicable?brandId=<ObjectId>
```

At least one filter param is required.

---

## 4. Response Format

All responses use `apiResponse.sendSuccess(res, statusCode, message, data)`.

### 4.1 Single Document Response

```json
{
  "status": "OK",
  "statusCode": 200,
  "message": "Size chart fetched successfully",
  "data": {
    "sizeChart": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Men's T-Shirt Size Guide",
      "slug": "mens-t-shirt-size-guide",
      "description": "Standard international sizing for men's t-shirts",
      "applicableLevel": "category",
      "applicableCategories": ["64f1a2b3c4d5e6f7a8b9c0d2"],
      "applicableSubCategories": [],
      "applicableProducts": [],
      "applicableVariants": [],
      "applicableBrands": [],
      "columns": [
        { "key": "chest", "label": "Chest", "unit": "inch", "order": 0 },
        { "key": "waist", "label": "Waist", "unit": "inch", "order": 1 },
        { "key": "length", "label": "Length", "unit": "inch", "order": 2 }
      ],
      "rows": [
        { "label": "S", "values": ["36", "30", "27"], "order": 0 },
        { "label": "M", "values": ["38", "32", "28"], "order": 1 },
        { "label": "L", "values": ["40", "34", "29"], "order": 2 },
        { "label": "XL", "values": ["42", "36", "30"], "order": 3 }
      ],
      "sizeLabels": ["S", "M", "L", "XL"],
      "minSize": "S",
      "maxSize": "XL",
      "measurementGuide": "...",
      "tips": [{ "title": "Chest", "description": "..." }],
      "videoUrl": "https://...",
      "supportedUnits": ["inch", "cm"],
      "conversionRules": [
        { "fromUnit": "inch", "toUnit": "cm", "factor": 2.54 }
      ],
      "isTemplateChart": false,
      "parentChartId": null,
      "childCharts": [],
      "isActive": true,
      "displayOrder": 0,
      "visibility": "public",
      "viewCount": 4,
      "usageCount": 2,
      "createdBy": "64f1a2b3c4d5e6f7a8b9c0d3",
      "updatedBy": null,
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  }
}
```

### 4.2 List Response

`fromCache: true` when served from Redis. `fromCache: false` when fetched from DB or result is empty.

```json
{
  "status": "OK",
  "statusCode": 200,
  "message": "Size charts fetched successfully",
  "data": {
    "sizeCharts": [ ...documents ],
    "total": 12,
    "fromCache": false
  }
}
```

Empty result:

```json
{
  "status": "OK",
  "statusCode": 200,
  "message": "No size charts found",
  "data": {
    "sizeCharts": [],
    "total": 0,
    "fromCache": false
  }
}
```

### 4.3 Create Response (`201 CREATED`)

```json
{
  "status": "OK",
  "statusCode": 201,
  "message": "Size chart created successfully",
  "data": { "sizeChart": { ...document } }
}
```

### 4.4 Delete Response

```json
{
  "status": "OK",
  "statusCode": 200,
  "message": "Size chart deleted successfully",
  "data": null
}
```

---

## 5. Constraints

| Field                              | Constraint                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `name`                             | Required. String. Max 100 chars.                                                                        |
| `applicableLevel`                  | Required. Enum: `category`, `subCategory`, `product`, `variant`, `brand`                                |
| `columns`                          | Required. Array. Min 1, Max 10 items.                                                                   |
| `column.key`                       | Required. Must match `/^[a-z0-9_]+$/` (lowercase alphanumeric + underscore only)                        |
| `column.unit`                      | Enum: `inch`, `cm`, `mm`, `kg`, `lbs`, `ml`, `l`, `unitless`. Default `unitless`                        |
| `rows`                             | Required. Array. Min 1 item.                                                                            |
| `row.values`                       | `values.length` must equal `columns.length` exactly.                                                    |
| `row.values[]`                     | Each value must be a non-empty string.                                                                  |
| `applicableXxx`                    | The array for the active `applicableLevel` must have ≥1 ObjectId (except when `isTemplateChart: true`). |
| `videoUrl`                         | Optional. Must match `/^https?:\/\/.+/` if provided.                                                    |
| `conversionRule.factor`            | Number ≥ 0.                                                                                             |
| `visibility`                       | Enum: `public`, `internal`, `draft`. Default `draft`.                                                   |
| `slug`                             | Auto-generated from `name`. Read-only from API.                                                         |
| `sizeLabels`, `minSize`, `maxSize` | Auto-populated from rows. Read-only from API.                                                           |
| `viewCount`, `usageCount`          | Managed by the system. Ignored in create/update body.                                                   |

---

## 6. Edge Cases

| Case                                                                             | Expected behaviour                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `rows[n].values.length` differs from `columns.length`                            | Pre-save hook rejects with `400 BAD_REQUEST` — "Row 'XL' has 2 values but expected 3"         |
| `applicableLevel: "category"` but `applicableCategories` is empty (non-template) | Pre-save hook rejects with `400 BAD_REQUEST` — "At least one applicable category is required" |
| `applicableLevel: "category"` but only `applicableProducts` array is populated   | Same rejection — wrong array for the declared level                                           |
| `isTemplateChart: true` with empty applicable arrays                             | Allowed — template charts are not scoped to specific entities                                 |
| Duplicate `name` generating same `slug`                                          | Pre-save hook rejects with `400 BAD_REQUEST` — "SizeChart with slug '...' already exists"     |
| `columns` array has >10 items                                                    | Schema validator rejects with `400 BAD_REQUEST`                                               |
| `column.key` contains uppercase or spaces (e.g., `"Chest Size"`)                 | Schema regex rejects with `400 BAD_REQUEST`                                                   |
| `from-template` with a non-template `chartId`                                    | Static method throws `400 BAD_REQUEST` — "Template not found or is not a template chart"      |
| `from-template` with a non-existent `templateId`                                 | `400 BAD_REQUEST` — same error                                                                |
| `GET /applicable` with no filter params                                          | Controller must throw `400 BAD_REQUEST` — "At least one filter is required"                   |
| `GET /get-sizechart/:slug` on inactive chart (admin)                             | Return the document regardless of `isActive`                                                  |
| `GET /applicable` on inactive chart (storefront)                                 | Exclude — only `isActive: true, visibility ≠ draft`                                           |
| Updating `name` to same value as existing chart                                  | Slug collision → `400 BAD_REQUEST`                                                            |
| `DELETE /delete-sizechart/:slug` when chart has `childCharts`                    | Should still delete — children keep their `parentChartId` reference. Document this decision.  |

---

## 7. Error Handling

All errors throw `new customError(message, statusCode)` inside `asynchandeler`.

| Scenario                                                              | Status Code | Message                                                                                            |
| --------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| Missing required field (`name`, `applicableLevel`, `columns`, `rows`) | `400`       | Mongoose validation message                                                                        |
| `row.values` length mismatch                                          | `400`       | `Row "<label>" has N values but expected M (number of columns)`                                    |
| Applicable array empty for level (non-template)                       | `400`       | `At least one applicable <level> is required`                                                      |
| `column.key` invalid format                                           | `400`       | `Column key must be lowercase alphanumeric`                                                        |
| Duplicate slug                                                        | `400`       | `SizeChart with slug "<slug>" already exists`                                                      |
| Invalid `videoUrl`                                                    | `400`       | `Video URL must be a valid HTTP/HTTPS URL`                                                         |
| `templateId` not a template                                           | `400`       | `Template not found or is not a template chart`                                                    |
| `:slug` not found                                                     | `404`       | `Size chart not found`                                                                             |
| No filter on `/applicable`                                            | `400`       | `At least one filter param is required (categoryId, subCategoryId, productId, variantId, brandId)` |
| Server / DB error                                                     | `500`       | Global error handler returns `Something went wrong` in production                                  |

---

## 8. Acceptance Criteria

### AC-01 — Create standard chart

- `POST /sizechart/create-sizechart` with valid `name`, `applicableLevel`, matching columns/rows → `201` with the saved document
- `slug` in response is auto-generated (kebab-case from `name`)
- `sizeLabels` = array of all `row.label` values, in sort order
- `minSize` = first label, `maxSize` = last label
- `visibility` defaults to `"draft"` when not provided
- `isActive` defaults to `true`

### AC-02 — Create template chart

- `isTemplateChart: true` with empty `applicableCategories` (or any applicable array) → `201` — no error
- `isTemplateChart: false` with empty applicable array for declared level → `400`

### AC-03 — Row/column alignment

- `columns` has 3 items, one `row.values` has 2 items → `400` with row label in error message
- All rows with `values.length === columns.length` → saves successfully

### AC-04 — Column key validation

- `column.key: "Chest Size"` → `400` (uppercase + space)
- `column.key: "chest_size"` → accepted
- `column.key: "chest2"` → accepted

### AC-05 — Get single with viewCount

- `GET /sizechart/get-sizechart/:slug` → `200` with document
- Subsequent `GET` on same slug → `viewCount` incremented by 1 (check via admin get or direct DB check)

### AC-06 — List with filters

- `GET /sizechart/get-sizechart?applicableLevel=category` → only category-level charts
- `GET /sizechart/get-sizechart?isActive=false` → only inactive charts
- `GET /sizechart/get-sizechart?isTemplateChart=true` → only templates
- No filter → returns all charts

### AC-07 — Applicable charts (storefront)

- Chart with `visibility: "draft"` is excluded from `/applicable` results
- Chart with `isActive: false` is excluded
- Chart with matching `applicableCategories` and `applicableLevel: "category"` is included when queried by `categoryId`

### AC-08 — Activate / deactivate

- `PUT /sizechart/update-sizechart/:slug/deactivate` → `isActive` becomes `false`, response `200`
- Deactivated chart excluded from `/applicable` results
- `PUT /sizechart/update-sizechart/:slug/activate` → `isActive` becomes `true`

### AC-09 — Create from template

- `POST /sizechart/from-template` with valid `templateId` → new chart inherits `columns`, `rows`, `conversionRules`
- New chart `parentChartId` = `templateId`
- Template's `childCharts` array includes the new chart's `_id`
- Providing a non-template ID → `400`

### AC-10 — Slug uniqueness

- Two charts with same `name` → second create returns `400` (slug collision)
- Updating `name` to a unique value → slug updates on save

### AC-11 — Delete

- `DELETE /delete-sizechart/:slug` on existing chart → `200`, document removed from DB
- Same request again → `404`

---

## 9. Controller Implementation Notes

The current `sizeChart.controller.js` must be fully replaced. Key points:

1. **No direct Cloudinary calls** — the model has no `image` field; do not add one. Upload logic does not apply here.
2. **No background fire-and-forget** — the current controller sends a response before DB operations finish. All operations must complete before `apiResponse.sendSuccess` is called.
3. **Use `req.user._id`** to set `createdBy` on create and `updatedBy` on update (once auth is enabled).
4. **`/applicable` route** calls `SizeChart.getApplicableCharts(filters)` static method directly.
5. **`viewCount` increment** — call `sizeChart.incrementViewCount()` inside `getSizeChartBySlug` only when the request comes from a storefront context (can be determined by absence of auth token, or a dedicated storefront flag).
6. **Slug is a read-only derived field** — strip it from `req.body` before passing to `findOneAndUpdate`.
7. **Strip read-only fields** before update: `sizeLabels`, `minSize`, `maxSize`, `slug`, `viewCount`, `usageCount`, `childCharts`, `parentChartId`.
