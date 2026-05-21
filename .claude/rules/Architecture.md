## Architecture

Node.js + Express REST API. MongoDB via Mongoose. Redis via ioredis. No frontend code in this repo.

**Request path:** `index.js` → `src/app.js` → `src/routes/index.js` → `src/routes/api/*.api.js` → `src/controller/*.controller.js` → `src/models/*.model.js`

**Module alias:** `@` maps to `src/` (via `module-alias`). Must call `require("module-alias/register")` before any `@/` import — already done in `index.js` and the image worker.

**Base URL:** `process.env.BASE_URL || "/api/v1"`

## Status Codes

Always import from `src/constant/constant.js` — never use raw numbers.

```js
const { statusCodes } = require("../constant/constant");
// statusCodes.OK         → 200  (success)
// statusCodes.CREATED    → 201  (resource created)
// statusCodes.BAD_REQUEST → 400
// statusCodes.UNAUTHORIZED → 401  (client error / not authenticated)
// statusCodes.FORBIDDEN  → 403  (unauthorized — access denied)
// statusCodes.NOT_FOUND  → 404
// statusCodes.SERVER_ERROR → 500
```

`apiResponse.sendSuccess(res, statusCodes.OK, "message", data)` for success.
`apiResponse.sendSuccess(res, statusCodes.CREATED, "message", data)` for creates.
`throw new customError("message", statusCodes.FORBIDDEN)` for access denied (403).
`throw new customError("message", statusCodes.UNAUTHORIZED)` for unauthenticated (401).
`throw new customError("message", statusCodes.BAD_REQUEST)` for validation errors (400).
`throw new customError("message", statusCodes.SERVER_ERROR)` for unexpected server errors (500).
Status Codes section — maps each code to its meaning (200/201/400/401/403/404/500) with concrete usage examples using statusCodes.\* constants, and clarifies that 401 = unauthenticated, 403 = access denied.
