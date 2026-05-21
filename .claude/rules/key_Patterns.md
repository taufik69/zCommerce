## Key Patterns

**Controllers** wrap everything in `asynchandeler`. Throw `new customError(message, statusCode)` for errors. Use `apiResponse.sendSuccess(res, status, message, data)` for success.

**RBAC** is two-layer:

1. `authGuard` (`src/middleware/authMiddleware.js`) — verifies JWT from `Authorization: Bearer <token>`, populates `req.user` with roles and permissions populated.
2. `authorize(moduleName, action)` (`src/middleware/checkPermission.middleware.js`) — checks `req.user.permissions[].permission.slug` against `moduleName` and `req.user.permissions[].actions` against `action`. Users with role slug `superadmin` bypass all checks.

**Validation** — Joi schemas live in `src/validation/`. The `validate(schema)` middleware from `src/middleware/validate.js` validates `req.body` and calls `next(customError)` on failure.

**Cache** — namespace versioning in Redis (`src/utils/cache.util.js`). `buildCacheKey(NS, suffix)` → `${NS}:v${version}:${suffix}`. `bumpNsVersion(NS)` invalidates all keys in that namespace atomically.

**Image subdocument** tracks upload state: `pending → processing → uploaded | failed`, with `tries` and `lastError` for observability.

**Socket.IO** (`src/socket/socket.js`) runs on the same HTTP server. Clients join rooms keyed by `userId`. Emit to a user anywhere via `getIO().to(userId).emit(event, data)`.

**Courier service** — `BaseCourier` in `src/service/couriers/` defines the interface (`createOrder`, `trackOrder`, `cancelOrder`, `bulkOrder`, `getStatus`). Pathao and SteadFast are concrete implementations.

**DTOs** — `src/dtos/all.dto.js` shapes raw Mongoose documents into API response objects.

**Scheduled jobs** — `node-cron` via `src/jobs/cleanTempFiles.job.js`, runs inside the main process, started in `index.js`.
