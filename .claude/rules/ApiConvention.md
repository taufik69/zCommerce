# API Convention

This documents the endpoint structure actually used in this codebase, the inconsistencies that exist, and the conventions to follow when adding new routes.

---

## Route Registration

Every route file must use:

```js
const express = require("express");
const _ = express.Router();
// ... routes ...
module.exports = _;
```

Prefer `_.route("/path").get(h).post(h)` chaining over `_.get("/path", h)` — the chaining form keeps all methods for a path together.

Register new route files in `src/routes/index.js` with a kebab-case mount prefix:

```js
_.use("/my-resource", require("./api/myResource.api"));
```

---

## Standard CRUD Shape

The cleanest pattern in this codebase (followed by `brand`, `categories`, `subcategories`, `discount`):

```
POST   /resource              create
GET    /resource              list all
GET    /resource/search       search (query params: ?q=)
GET    /resource/:slug        get single
PUT    /resource/:slug        update
DELETE /resource/:slug        delete
PUT    /resource/:slug/activate    toggle on
PUT    /resource/:slug/deactivate  toggle off
GET    /resource-active       filtered list — active only
GET    /resource-inactive     filtered list — inactive only
```

**Route file skeleton:**

```js
_.route("/resource")
  .post(/* [authGuard, authorize("resource","add"),] */ upload, controller.create)
  .get(controller.getAll);

_.route("/resource/search").get(controller.search);

_.route("/resource/:slug")
  .get(controller.getSingle)
  .put(/* [authGuard, authorize("resource","edit"),] */ upload, controller.update)
  .delete(/* [authGuard, authorize("resource","delete"),] */ controller.delete);

_.route("/resource/:slug/activate").put(controller.activate);
_.route("/resource/:slug/deactivate").put(controller.deactivate);
```

---

## Route Prefix Mount Points

Prefixes from `src/routes/index.js` — new resources must follow the same kebab-case pattern:

| Prefix | File |
|---|---|
| `/auth` | `user.api.js` |
| `/product` | `product.api.js` |
| `/coupon` | `coupon.api.js` |
| `/cart` | `cart.api.js` |
| `/order` | `order.api.js` |
| `/payment` | `payment.api.js` |
| `/delivery-charge` | `deliveryCharge.api.js` |
| `/courier` | `courier.api.js` |
| `/courier-return` | `courierReturn.api.js` |
| `/stock` | `stockAdjust.api.js` |
| `/purchase` | `purchase.api.js` |
| `/sizechart` | `sizeChart.api.js` |
| `/sales` | `sales.api.js` |
| `/sales-return` | `salesReturn.api.js` |
| `/merchant` | `merchant.api.js` |
| `/supplier` | `supplier.api.js` |
| `/customer` | `customer.api.js` |
| `/employee` | `employee.api.js` |
| `/account` | `account.api.js` |
| `/transaction` | `createTransaction.api.js` |
| `/transaction-category` | `transitionCategory.api.js` |
| `/moneytransfer` | `moneyTransfer.api.js` |
| `/fundhandover` | `fundhandover.api.js` |
| `/banner` | `banner.api.js` |
| `/discount-banner` | `discountbanner.api.js` |
| `/siteinformation` | `siteinformation.api.js` |
| `/outletinformation` | `outletinformation.api.js` |
| `/invoice` | `invoice.api.js` |
| `/sms` | `sms.api.js` |
| `/userpermission` | `userpermission.api.js` |
| `/permission` | `permisson.api.js` |
| *(root)* | `Category.api.js`, `subCategory.api.js`, `brand.api.js`, `variant.api.js`, `discount.api.js`, `wishList.api.js` |

---

## Identifiers

Prefer `:slug` for resources that have a `slug` field (Category, Brand, Product, Variant, SizeChart, Discount, Coupon, Role, Permission, etc.).

Use `:id` only for resources without a slug (Order, Purchase, DeliveryCharge, FundHandover, Employee, MoneyTransfer, Transaction, StockAdjust).

Avoid resource-specific param names like `:customerId`, `:supplierId`, `:saleId` — these already exist in legacy routes but don't add value over `:id`.

---

## Path Casing and Verb Rules

- All path segments: **kebab-case** — `/create-account` not `/createAccount` or `/createaccount`
- No verb prefix on standard CRUD — use HTTP method + noun: `POST /brand` not `GET /create-brand`
- Verb in path only when the action cannot be expressed by an HTTP method alone:

```
GET  /resource/search          ✓  search
GET  /resource/price-range     ✓  filter by range
POST /courier/pathao-bulk-create-orders  ✓  bulk action
GET  /resource-active          ✓  filtered list
```

---

## Status Toggle Endpoints

**Use the sub-resource style** (cleanest, follows Category/Brand/Subcategory):

```
PUT /resource/:slug/activate    ✓  preferred
PUT /resource/:slug/deactivate  ✓  preferred
```

**Do not add** new routes using the older styles that exist in legacy code:

```
POST /resource/active           ✗  legacy (variant, discount)
PUT  /resource-active/:slug     ✗  legacy (permission)
```

---

## Soft Delete

Suffix position must be consistent — prefer:

```
DELETE /resource/:id/soft   ✓  preferred (keep hard delete at /:id)
```

Legacy routes use both `/delete-resource-soft/:id` (suffix) and `/soft-delete-resource/:id` (prefix). Do not add new ones in either style — use the sub-action suffix form above.

---

## Auth Middleware Placement

Auth and permission guards are commented out on most routes. When adding a new route, write the guards in commented form so the intent is preserved:

```js
_.route("/resource/:slug")
  .put(
    // authGuard,
    // authorize("resource", "edit"),
    controller.update
  );
```

The permission module name (first arg to `authorize`) must match the `slug` field of the corresponding `Permission` document in the database.

---

## Pagination and Filtering

No standard exists yet across the codebase. Follow the pattern used in the module you are working in. When adding pagination to a new resource, use query params:

```
GET /resource?page=1&limit=20&sort=-createdAt&search=term
```

---

## Known Inconsistencies (do not replicate)

These exist in the current codebase but should not be copied to new routes:

| Issue | Example | Correct form |
|---|---|---|
| No hyphens in path | `/createproduct`, `/getproduct`, `/allorders` | `/create-product`, `/get-product`, `/all-orders` |
| Verb-prefix path for CRUD | `/create-account`, `/all-account` | `POST /account`, `GET /account` |
| Mixed param names | `:customerId`, `:supplierId`, `:saleId` | `:id` |
| Status toggle as POST body | `POST /variant/active` | `PUT /variant/:slug/activate` |
| PascalCase route file | `Category.api.js` | `category.api.js` |
| Misspelled file/mount | `permisson.api.js`, `/byretrun-Sale` | `permission.api.js`, `/buy-return-sale` |
| Typo in path param | `/add-wishtlist` | `/add-wishlist` |
| `_.get/post` direct style | `_.get("/path", h)` mixed with `_.route()` | use `_.route().get()` throughout |
| Soft delete prefix/suffix mismatch | `/soft-delete-supplier` vs `/delete-employee-soft` | `DELETE /:id/soft` |
