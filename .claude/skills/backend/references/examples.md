# Domain Examples

Reference implementations from the codebase. Read the relevant section when implementing similar features.

## Table of Contents
- [Category Controller](#category-controller) — class-based, full cache + image queue pattern
- [Brand Controller](#brand-controller) — function exports, same pattern
- [Product Validation](#product-validation) — complex Joi with conditionals + multipart bracket expansion
- [Auth Middleware](#auth-middleware) — JWT guard + permission check
- [Validate Middleware](#validate-middleware) — generic body validator
- [Known Bugs](#known-bugs)

---

## Category Controller

`src/controller/category.controller.js` — the gold standard. Class-based, exported as `new CategoryController()`.

Key patterns:
- `const NS = "category"` at top
- `buildCacheKey(NS, "all")` / `buildCacheKey(NS, "slug:${slug}")` / `buildCacheKey(NS, "search:${term}")`
- On write: always `await bumpNsVersion(NS)` AFTER save
- Cloudinary delete in `setImmediate()` — non-blocking after DB delete
- Empty getAll → `sendSuccess(res, OK, "No categories found", { categories: [], fromCache: false })`
- Empty getSingle → `sendSuccess(res, OK, "Category not found", { category: null, fromCache: false })`
- `activateCategory`: `findOneAndUpdate({ slug, isActive: false }, { isActive: true })` — returns null if already active
- `getCategoryPagination`: `Promise.all([find().skip().limit(), countDocuments()])` for totals
- `getCategoriesWithSearch`: `escapeRegex()` helper to sanitize user input before `$regex`

---

## Brand Controller

`src/controller/brand.controller.js` — function export style, same cache + BullMQ pattern.

Differences from Category:
- `getBrandBySlug` throws `customError(NOT_FOUND)` instead of returning `sendSuccess(null)` — this is an inconsistency; for new code follow the Category pattern (return `sendSuccess(null)`)
- `searchBrand` uses `?q=` param (not `?search=`) and searches both `name` and `slug`

---

## Product Validation

`src/validation/product.validation.js` — most complex validation in the codebase.

Key patterns:
```js
// ALWAYS expand bracket keys before Joi for multipart forms
const expandedBody = expandBracketKeys(req.body);
const value = await productCreateSchema.validateAsync(expandedBody);

// Conditional required fields
sku: joi.string().trim().when("variantType", {
  is: "singleVariant",
  then: joi.required(),
  otherwise: joi.any().strip(),
}),

// Strip unknown to prevent mass-assignment
.options({ abortEarly: false, stripUnknown: { objects: true } });

// Object ID validation
const objectId = joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// File validation helper
const validateImageFile = (file, label) => {
  if (file.size > 5 * 1024 * 1024)
    throw new customError(`${label} size must be less than 5 MB`, statusCodes.BAD_REQUEST);
};
```

`req.files` from `multipleFileUploadWithFields` arrives as `{ thumbnail: [file], image: [file, ...], ogImage: [file] }`.

---

## Auth Middleware

### authGuard (`src/middleware/authMiddleware.js`)
```js
// reads Authorization: Bearer <token> or req.body.token
// populates req.user with roles + permissions.permission populated
// selects out password, refreshToken, wishList, cart, etc.
```

### authorize(moduleName, action) (`src/middleware/checkPermission.middleware.js`)
```js
// superadmin (roles[].slug === "superadmin") → next() immediately
// otherwise: req.user.permissions[].permission.slug === moduleName
//         && req.user.permissions[].actions.includes(action)
// sets req.permission on success
// throws customError(403) on denied
```

---

## Validate Middleware

`src/middleware/validate.js` — generic Joi body validator:
```js
const validate = require("../middleware/validate");
const { mySchema } = require("../validation/my.validation");

// In route file:
_.route("/x").post(validate(mySchema), controller.createX);
```
Note: there is a known double-`next()` bug in validate.js — the error branch calls `next(err)` but doesn't `return`, so it falls through to the success `next()`. Harmless in practice (Express ignores the second call after headers are sent) but worth knowing.

---

## Known Bugs

| Location | Issue | Workaround |
|---|---|---|
| `GlobalErrorHandeler.js:30` | `NODE_ENV === "developement"` (typo) | Set `NODE_ENV=developement` to get stack traces |
| `authMiddleware.js:32` | "User not found" sends `apiResponse.sendSuccess(res, 401, ...)` instead of throwing | Existing behavior — don't change without testing |
| `validate.js:14` | Double `next()` on error path | No fix needed — harmless |
| `multer.middleware.js:82-91` | `multipleFileUpload` error sends raw JSON instead of `next(customError)` | Use `multipleFileUploadWithFields` for new routes where possible |
| `user.controller.js:133` | `refreshToken` accesses `.trim()` without null-check on cookie | Will crash if cookie absent — known issue |
| `app.js:54` | Rate limiter `limit: 1000000000` (effectively disabled) | Intentional for now |
| `REFRESH_TOKEN_SCCERET` | Typo in env var name used everywhere | Must match exactly — don't fix without updating all references |
