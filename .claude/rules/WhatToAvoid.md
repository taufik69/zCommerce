## What to Avoid

- **Don't call `cloudinaryFileUpload()` in controllers** — always enqueue to BullMQ. Direct uploads block the request and skip the retry/cache-bust machinery.
- **Don't use `cloudinaryFileUpload(path, { deleteAfter: true })` inside the worker** — the worker always passes `{ deleteAfter: false }` and manages file cleanup itself across retry attempts.
- **Don't skip `asynchandeler`** — unhandled promise rejections in route handlers won't reach the global error handler.
- **Don't use raw status code integers** — use `statusCodes.*` from `src/constant/constant.js`.
- **Don't set `slug` manually** — models with a pre-save slug hook will overwrite it on save; set only `name`.
- **Don't implement v2 schema changes** without explicit confirmation — `zCommerce-v2-Architecture.md` is a planning document, not an active migration.
- **Don't use `req.body` raw in multipart handlers** — call `expandBracketKeys(req.body)` first.
