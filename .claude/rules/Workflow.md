## Workflow Constraints

1. **Every controller function must be wrapped in `asynchandeler`** from `src/lib/asyncHandeler.js`. Never use a bare `async (req, res) => {}` as a route handler.

2. **Image uploads always go through BullMQ** — never call `cloudinaryFileUpload()` directly in a controller. The flow is:
   - Multer saves file to `./public/temp/`
   - Controller enqueues a job via `imageQueue.add(...)` from `src/queues/image.queue.js`
   - Call `bumpNsVersion(NS)` immediately after enqueue to invalidate stale cache
   - The image worker (`npm run worker:image`) runs as a **separate process** — without it, images stay `pending` forever

3. **Cache invalidation on every write** — after any create/update/delete that affects cached data, call `bumpNsVersion(NS)`. This atomically increments `${NS}:v`, making all versioned keys for that namespace unreachable.

4. **Multipart form-data bracket keys must be expanded** — Multer does not auto-expand `key[0]` or `key[field]` syntax. Always call `expandBracketKeys(req.body)` from `src/utils/parseFormData.util.js` before using `req.body` in routes that accept nested/array fields.

5. **`NODE_ENV` typo in error handler** — `src/lib/GlobalErrorHandeler.js` checks for `"developement"` (misspelled). Full stack traces only appear when `NODE_ENV=developement` (with the typo). `"development"` (correct spelling) falls through to the production error format. morgan uses the correct spelling `"development"`.

6. **Auth middleware is widely commented out** — many routes have `authGuard` and `authorize()` commented out and are effectively public. Always check the specific `*.api.js` file before assuming a route is protected. Do not remove commented-out auth lines — they mark the intended protection.

7. **Temp file lifecycle** — Multer writes to `./public/temp/`. The BullMQ worker deletes each file after successful upload. `src/jobs/cleanTempFiles.job.js` (node-cron, runs in main process) sweeps any orphaned files. Never write temp files outside `./public/temp/`.

8. **SKU and barcode are numeric-only** — validated by `/^\d+$/` regex in both the model and Joi validators. Reject non-numeric values early.
9. **RBAC permissions are checked at the controller level** — `authGuard` populates `req.user`, but you must call `authorize(moduleName, action)` in each controller function to enforce permissions. Superadmins bypass all checks.
   10 . if get request done query and data is empty then return like this apiResponse.sendSuccess(res,statusCodes.OK,"Category not found",{ category:fromCache: false },);
   only for getAllcontroller and getSignle controller
   10 .Auth middleware is widely commented out — never assume a route is protected 11. The "developement" typo in GlobalErrorHandeler.js — must match exactly to get stack traces
