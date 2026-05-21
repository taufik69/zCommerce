# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start with nodemon (development)
npm start            # same as dev
npm run build        # deploy via pm2 (production)
npm run worker:image # start image upload worker (separate process)
npm run seed:permissions
npm run seed:roles
npm run seed:delivery
npm run admin        # seed superadmin user
```

There is no test suite configured.


## Environment Variables

Required: `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SCCERET` (note the typo — used as-is in the codebase), `REDIS_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `DASHBOARD_URL`, Cloudinary credentials (`CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), SSLCommerz keys, courier API credentials.

## v2 Migration Plan

`zCommerce-v2-Architecture.md` documents a planned major refactor. Key schema changes:
- `variant.model.js` becomes an **embedded subdocument inside Product** (currently a separate collection with its own `_id` and `slug`).
- `subcategory.model.js` is replaced by a self-referential `Category` (`parent: null` = root).
- New models: `FlashSale`, `AttributeDefinition`, merged `Banner`.
- `discount.model.js` gets production-grade multi-level targeting (variant → product → brand → category → global priority cascade).

The current `src/models/` reflects v1. Do not implement v2 schema changes without confirming the migration is in scope.

