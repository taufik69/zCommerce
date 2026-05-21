## Naming Conventions

**Files**

- Routes: `kebab-case.api.js` → `src/routes/api/`
- Controllers: `camelCase.controller.js` → `src/controller/`
- Models: `camelCase.model.js` → `src/models/`
- Validations: `camelCase.validation.js` → `src/validation/`
- Middlewares: `camelCase.middleware.js` → `src/middleware/`
- Queues/workers/jobs follow the same `camelCase.<type>.js` pattern

**Code**

- Mongoose model names: `PascalCase` string — `mongoose.model("Category", schema)`
- Router variable: always `const _ = express.Router()` (not `router`)
- Controller functions: `camelCase` verbs — `createCategory`, `getAllCategories`, `getSingleCategory`, `updateCategory`, `deleteCategory`
- Cache namespace constant: `const NS = "category"` — lowercase entity name, defined at top of controller
- API endpoint paths: `kebab-case` — `/get-sizechart`, `/create-sizechart`, `/update-sizechart`
- Slug fields: auto-generated from `name` via Mongoose pre-save hooks on Category, Brand, Product, Variant, SizeChart, Discount — never set manually
  Naming Conventions section — covers file naming patterns, the const \_ = express.Router() convention, controller function verb patterns (create, getAll, getSingle, update,
  delete), cache namespace constant pattern, kebab-case API paths, and the auto-generated slug rule.
