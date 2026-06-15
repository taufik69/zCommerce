---
name: backend
description: >
  Use this skill whenever working on the jahirCommerce Node.js/Express backend — adding a new route, controller, model,
  validation, middleware, or any feature in src/. Trigger on any backend task: "add an endpoint", "create a controller",
  "add a model", "write a Joi schema", "add a route", "fix a controller bug", "create CRUD for X", "add image upload",
  "add caching", "add RBAC to a route", or when the user names any existing domain (category, brand, product, order, etc.).
  Also trigger when the user asks about error handling, asynchandeler, customError, apiResponse, statusCodes, BullMQ,
  Redis cache, or the image worker pipeline.
---

# jahirCommerce Backend Skill

Node.js + Express REST API. MongoDB via Mongoose. Redis (ioredis) for caching. BullMQ for image upload jobs. Socket.IO on the same HTTP server.

**Request path:**
`index.js` → `src/app.js` → `src/routes/index.js` → `src/routes/api/*.api.js` → `src/controller/*.controller.js` → `src/models/*.model.js`

**Module alias:** `@` = `src/` (via `module-alias`). Already registered in `index.js` and the image worker.

**Base URL:** `process.env.BASE_URL || "/api/v1"`

---

## Status Codes — always import, never use raw numbers

```js
const { statusCodes } = require("../constant/constant");
// statusCodes.OK          → 200
// statusCodes.CREATED     → 201
// statusCodes.BAD_REQUEST → 400
// statusCodes.UNAUTHORIZED → 401   (not authenticated)
// statusCodes.FORBIDDEN   → 403   (access denied)
// statusCodes.NOT_FOUND   → 404
// statusCodes.SERVER_ERROR → 500
```

---

## Error Handling

### Throwing errors
```js
throw new customError("message", statusCodes.NOT_FOUND);
```
`customError` sets `isOperationalError: true`, `statusCode`, and `status`. The global handler (`src/lib/GlobalErrorHandeler.js`) catches it and responds.

> **Typo that must match:** `NODE_ENV === "developement"` (misspelled) gives full stack traces. The correct spelling `"development"` falls through to the production format.

### asynchandeler — wrap every controller function
```js
const { asynchandeler } = require("../lib/asyncHandeler");

exports.createX = asynchandeler(async (req, res) => {
  // throw customError here — it reaches the global handler automatically
});
```
**Never use a bare `async (req, res) => {}` as a route handler.**

### apiResponse — success responses
```js
const { apiResponse } = require("../utils/apiResponse");

// Read success
apiResponse.sendSuccess(res, statusCodes.OK, "message", data);
// Create success
apiResponse.sendSuccess(res, statusCodes.CREATED, "message", data);
```
Always use `sendSuccess` for both success and error responses that have a data payload. `sendError` exists but is rarely used.

### Empty result rules — critical, enforced across all controllers
- **getAll**: return `sendSuccess(res, OK, "X not found", { items: [], fromCache: false })` — **never throw 404**
- **getSingle**: return `sendSuccess(res, OK, "X not found", { x: null, fromCache: false })` — **never throw 404**

This rule exists because an empty list is a valid successful response, not an error. The frontend must check `data.length === 0` not catch an error. Always wrap the response in a named key matching the resource (`{ stockAdjusts: [] }`, `{ categories: [] }`, etc.).

```js
// ✓ CORRECT — getAll empty
if (!items.length) {
  return apiResponse.sendSuccess(res, statusCodes.OK, "X not found", { items: [], fromCache: false });
}
return apiResponse.sendSuccess(res, statusCodes.OK, "X fetched", { items, fromCache: false });

// ✗ WRONG — do not do this
if (!items.length) throw new customError("X not found", statusCodes.NOT_FOUND);
```

### `throw` vs `return new` — critical distinction
Always `throw new customError(...)`. Writing `return new customError(...)` silently constructs an object and discards it — the error is never sent to the client, the function continues executing, and the response hangs or sends wrong data.

```js
// ✓ CORRECT
throw new customError("Product not found", statusCodes.NOT_FOUND);

// ✗ WRONG — error is swallowed, execution continues
return new customError("Product not found", statusCodes.NOT_FOUND);
```

---

## Controller Template

```js
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");
const XModel = require("../models/x.model");

const NS = "x";           // lowercase entity name — must match model registry key in image.worker.js
const CACHE_TTL = 60 * 60; // 1 hour

// CREATE
exports.createX = asynchandeler(async (req, res) => {
  // validate first (Joi or manual)
  const x = await XModel.create({ ...req.body });
  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.CREATED, "X created successfully", x);
});

// GET ALL
exports.getAllX = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Fetched", { items: cached, fromCache: true });

  const items = await XModel.find({}).sort({ createdAt: -1 }).lean();
  if (!items.length) return apiResponse.sendSuccess(res, statusCodes.OK, "X not found", { items: [], fromCache: false });

  await setCache(cacheKey, items, CACHE_TTL);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Fetched", { items, fromCache: false });
});

// GET SINGLE
exports.getSingleX = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Fetched", { x: cached, fromCache: true });

  const x = await XModel.findOne({ slug }).lean();
  if (!x) return apiResponse.sendSuccess(res, statusCodes.OK, "X not found", { x: null, fromCache: false });

  await setCache(cacheKey, x, CACHE_TTL);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Fetched", { x, fromCache: false });
});

// UPDATE
exports.updateX = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const x = await XModel.findOne({ slug });
  if (!x) throw new customError("X not found", statusCodes.NOT_FOUND);

  if (req.body.name) x.name = req.body.name;
  const updated = await x.save();
  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "X updated", updated);
});

// DELETE
exports.deleteX = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const x = await XModel.findOneAndDelete({ slug });
  if (!x) throw new customError("X not found", statusCodes.NOT_FOUND);
  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "X deleted", { slug });
});

// ACTIVATE / DEACTIVATE
exports.activateX = asynchandeler(async (req, res) => {
  const x = await XModel.findOneAndUpdate({ slug: req.params.slug, isActive: false }, { isActive: true }, { new: true });
  if (!x) return apiResponse.sendSuccess(res, statusCodes.OK, "X not found or already active", { x: null, fromCache: false });
  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "X activated", x);
});

exports.deactivateX = asynchandeler(async (req, res) => {
  const x = await XModel.findOneAndUpdate({ slug: req.params.slug, isActive: true }, { isActive: false }, { new: true });
  if (!x) return apiResponse.sendSuccess(res, statusCodes.OK, "X not found or already inactive", { x: null, fromCache: false });
  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "X deactivated", x);
});
```

---

## Route File Template

```js
const express = require("express");
const _ = express.Router();               // always "_ ", never "router"
const X = require("../../controller/x.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/x")
  .post(
    // authGuard,
    // authorize("x", "add"),
    multipleFileUpload("image", 1),
    X.createX,
  )
  .get(X.getAllX);

_.route("/x/search").get(X.searchX);

_.route("/x/:slug")
  .get(X.getSingleX)
  .put(
    // authGuard,
    // authorize("x", "edit"),
    multipleFileUpload("image", 1),
    X.updateX,
  )
  .delete(
    // authGuard,
    // authorize("x", "delete"),
    X.deleteX,
  );

_.route("/x/:slug/activate").put(X.activateX);
_.route("/x/:slug/deactivate").put(X.deactivateX);

_.route("/x-active").get(X.getActiveX);
_.route("/x-inactive").get(X.getInactiveX);

module.exports = _;
```

Register in `src/routes/index.js`:
```js
_.use("/x", require("./api/x.api"));
```

---

## Model Template

```js
const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    status: { type: String, enum: ["pending", "processing", "uploaded", "failed"], default: "pending" },
    localPath: { type: String, default: "" },
    tries: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { _id: false },
);

const xSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    image: { type: imageSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

xSchema.index({ isActive: 1, createdAt: -1 });

// Auto-slug
xSchema.pre("save", function (next) {
  if (this.isModified("name")) this.slug = slugify(this.name, { lower: true, strict: true });
  next();
});

// Unique-slug check
xSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug, _id: { $ne: this._id } });
    if (existing) return next(new customError(`"${this.name}" already exists`, statusCodes.BAD_REQUEST));
    next();
  } catch (e) { next(e); }
});

const X = mongoose.models.X || mongoose.model("X", xSchema);
module.exports = X;
```

**Never set `slug` manually** — pre-save hook overwrites it from `name`.

---

## Validation Template (Joi)

```js
const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const xSchema = joi.object({
  name: joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required.",
    "string.min": "Name must be at least 2 characters.",
    "any.required": "Name is required.",
  }),
}).options({ abortEarly: false, allowUnknown: true });

const validateX = async (req) => {
  const value = await xSchema.validateAsync(req.body);

  if (!req.files || !req.files.length) throw new customError("Image is required", statusCodes.BAD_REQUEST);
  if (req.files.length > 1) throw new customError("Only 1 image allowed", statusCodes.BAD_REQUEST);
  const file = req.files[0];
  if (file.fieldname !== "image") throw new customError('Field name must be "image"', statusCodes.BAD_REQUEST);
  if (file.size > 5 * 1024 * 1024) throw new customError("Image must be < 5 MB", statusCodes.BAD_REQUEST);

  return { name: value.name, image: file };
};

module.exports = { validateX };
```

For multipart forms with nested fields, call `expandBracketKeys(req.body)` from `src/utils/parseFormData.util.js` before Joi validation. Multer does not auto-expand `field[0]` syntax.

---

## Image Upload Pipeline

**Never call `cloudinaryFileUpload()` in controllers.** Always go through BullMQ:

```js
// In controller (create with image):
const doc = await XModel.create({ name, image: { status: "pending", localPath: file.path } });

await imageQueue.add("create-x-image", {
  modelName: NS,          // must match a key in MODELS inside src/workers/image.worker.js
  documentId: doc._id,
  localPath: file.path,
});
await bumpNsVersion(NS);  // bump immediately so stale cache is evicted
```

```js
// In controller (update with image):
if (req.files?.length) {
  const oldPublicId = doc.image?.publicId || null;
  doc.image.status = "pending";
  doc.image.localPath = req.files[0].path;
  doc.image.tries = 0;
  doc.image.lastError = "";
  await imageQueue.add("update-x-image", {
    modelName: NS, documentId: doc._id, localPath: req.files[0].path, oldPublicId,
  });
}
await doc.save();
await bumpNsVersion(NS);
```

If you add a new model that uses image uploads, register it in `src/workers/image.worker.js` under the `MODELS` map.

**Worker lifecycle:** `npm run worker:image` must run as a separate process. Without it, images stay `"pending"` forever.

---

## Cache Utilities

```js
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");

const NS = "category";

// Build a versioned key — all keys for NS are atomically invalidated by bumpNsVersion
const key = await buildCacheKey(NS, "all");          // → "category:v3:all"
const key2 = await buildCacheKey(NS, `slug:${slug}`);

// Read
const cached = await getCache(key);

// Write (ttl in seconds)
await setCache(key, data, 60 * 60);

// Invalidate all keys for this namespace (call after every create/update/delete)
await bumpNsVersion(NS);
```

---

## RBAC

```js
// Route file — always leave guards as comments, never remove them
_.route("/x/:slug").put(
  // authGuard,
  // authorize("x", "edit"),
  X.updateX,
);
```

`authGuard` populates `req.user` with `roles[]` and `permissions[].{permission, actions[]}` populated.

`authorize(moduleName, action)` — `moduleName` must match the `slug` field of the `Permission` document in MongoDB. Standard actions: `"add"`, `"edit"`, `"delete"`, `"view"`.

Superadmin (`roles[].slug === "superadmin"`) bypasses all `authorize` checks.

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Route file | `kebab-case.api.js` | `sizeChart.api.js` |
| Controller file | `camelCase.controller.js` | `sizeChart.controller.js` |
| Model file | `camelCase.model.js` | `sizeChart.model.js` |
| Validation file | `camelCase.validation.js` | `sizeChart.validation.js` |
| Mongoose model name | `PascalCase` | `mongoose.model("SizeChart", schema)` |
| Router variable | `const _ = express.Router()` | always |
| Controller functions | `camelCase` verbs | `createSizeChart`, `getAllSizeCharts`, `getSingleSizeChart` |
| Cache namespace constant | `const NS = "sizechart"` | lowercase at top of controller |
| API path segments | `kebab-case` | `/size-chart`, `/create-sizechart` |

**Path rules:**
- Use HTTP verb + noun for CRUD: `POST /brand` not `GET /create-brand`
- Status toggles: `PUT /:slug/activate` and `PUT /:slug/deactivate` (never `POST /active`)
- Soft delete: `DELETE /:id/soft`
- Identifier param: `:slug` for resources with a slug field, `:id` for everything else

---

## What to Avoid

- **Raw status codes** — never `res.status(400)` or `res.status(500)`
- **Skipping asynchandeler** — bare `async (req, res) => {}` breaks the error pipeline
- **Direct Cloudinary uploads in controllers** — always use `imageQueue.add(...)`
- **Setting slug manually** — the pre-save hook overwrites it from `name`
- **Using `req.body` raw in multipart handlers** — call `expandBracketKeys(req.body)` first
- **Removing commented-out auth guards** — they document intent; keep them commented
- **Implementing v2 schema changes** without explicit confirmation — `zCommerce-v2-Architecture.md` is a planning doc only

---

## Adding a Completely New Domain — Checklist

1. **Model** `src/models/x.model.js` — schema, indexes, pre-save slug + uniqueness hooks
2. **Validation** `src/validation/x.validation.js` — Joi schema, file checks
3. **Controller** `src/controller/x.controller.js` — CRUD + activate/deactivate, cache pattern
4. **Route file** `src/routes/api/x.api.js` — `_.route()` chaining, auth guards commented in
5. **Register** in `src/routes/index.js` with `_.use("/x", require("./api/x.api"))`
6. **Image worker** — add `x: xModel` to `MODELS` in `src/workers/image.worker.js` if model has images

See `references/examples.md` for domain-specific examples (Category, Brand, Product patterns).
