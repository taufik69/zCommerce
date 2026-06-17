# Purchase Return — Implementation Guide

> **Status:** Planning only. Do not implement without explicit confirmation.

---

## Overview

This document describes exactly what needs to be built, in what order, and why each decision was made. It covers backend (Node/Express/Mongo) and frontend (React/TypeScript) side by side.

---

## 1. What We Are Building

A Purchase Return module that allows inventory staff to record products/variants being returned to a supplier. Each return:

- Creates a `PurchaseReturn` document
- Reduces stock on returned products/variants
- Increases `purchaseReturnStock` (cumulative counter) on those same records
- Reduces the supplier's `openingDues` and `totalPurchaseDue` by the total return amount
- Runs entirely inside a single MongoDB transaction — all-or-nothing

---

## 2. Files to Create or Modify

### Backend

| Action | File |
|--------|------|
| **Create** | `src/models/purchaseReturn.model.js` |
| **Modify** | `src/models/product.model.js` — add `purchaseReturnStock` field |
| **Modify** | `src/models/variant.model.js` — add `purchaseReturnStock` field |
| **Modify** | `src/models/supplier.model.js` — add `totalPurchaseDue` field (currently only `openingDues` exists) |
| **Create** | `src/controller/purchaseReturn.controller.js` |
| **Create** | `src/routes/api/purchase-return.api.js` |
| **Modify** | `src/routes/index.js` — register `/purchase-return` mount |

### Frontend

| Action | File |
|--------|------|
| **Create** | `frontend/src/components/purchase/PurchaseReturnForm.tsx` |

---

## 3. Model: `purchaseReturn.model.js`

Model name (Mongoose string): `"PurchaseReturn"`

```
purchaseReturnSchema {
  supplier:          ObjectId → "Supplier"   (required)
  returnDate:        Date                     (default: Date.now)
  remarks:           String                   (optional, trim)
  totalReturnAmount: Number                   (default: 0)

  products: [
    {
      product:       ObjectId → "Product"    (nullable)
      variant:       ObjectId → "Variant"    (nullable)
      quantity:      Number                  (required, min: 1)
      purchasePrice: Number                  (required)
      subtotal:      Number                  (purchasePrice × quantity)
    }
  ]
}
timestamps: true
```

**Notes:**
- No `invoiceNumber` needed — use auto-generated `_id`.
- Each `products[]` item must have either `product` or `variant` (not both null).
- `subtotal` is stored redundantly for display and audit — do not recalculate from DB on reads.
- Follow the `salesReturn.model.js` shape as a reference for the `products[]` subdocument.

---

## 4. Model Modifications

### `product.model.js`
Add one field after the existing `stock` field:
```js
purchaseReturnStock: { type: Number, default: 0 }
```

### `variant.model.js`
Add one field after the existing `stockVariant` field:
```js
purchaseReturnStock: { type: Number, default: 0 }
```

### `supplier.model.js`
The `openingDues` field exists. The requirement references `totalPurchaseDue` as a second field.
Current model only has `openingDues`. **Add:**
```js
totalPurchaseDue: { type: Number, default: 0, min: 0 }
```
On return, reduce both:
```js
supplier.openingDues     -= totalReturnAmount;
supplier.totalPurchaseDue -= totalReturnAmount;
```
Floor both at 0 (use `Math.max(0, ...)`) — same pattern as `deletePurchase` in `purchase.controller.js`.

---

## 5. Backend: Controller Functions

### Cache namespace
```js
const NS = "purchase-return";
const CACHE_TTL = 60 * 60;
```

---

### 5a. `createPurchaseReturn`

**Validation (throw before opening session):**
- `supplier` is required
- `products` array must be non-empty
- Each item: `quantity >= 1`, `purchasePrice > 0`, at least one of `product`/`variant` is non-null

**Transaction flow:**
1. Open `mongoose.startSession()`, `startTransaction()`
2. Create `PurchaseReturn` document with `{ session }`
3. Calculate `totalReturnAmount = Σ (purchasePrice × quantity)` (also set per-item `subtotal`)
4. Collect all unique productIds and variantIds from the payload
5. Batch-fetch all products in one query: `Product.find({ _id: { $in: productIds } }).session(session)`
6. Batch-fetch all variants in one query: `Variant.find({ _id: { $in: variantIds } }).session(session)`
7. Build `bulkWrite` ops for Product:
   - `$inc: { stock: -quantity, purchaseReturnStock: +quantity }`
8. Build `bulkWrite` ops for Variant:
   - `$inc: { stockVariant: -quantity, purchaseReturnStock: +quantity }`
9. Execute `Product.bulkWrite(ops, { session })`
10. Execute `Variant.bulkWrite(ops, { session })`
11. Fetch supplier, update dues, save with `{ session }`
12. `commitTransaction()`, `endSession()`
13. `bumpNsVersion(NS)` — also bump `"purchase"` NS if needed by UI

**Stock validation before writing:**
- After batch-fetch, check each item's available stock vs return quantity.
- If `product.stock < quantity` or `variant.stockVariant < quantity` → throw `customError(..., BAD_REQUEST)` and abort.

**Error handling:**
- `catch` → `abortTransaction()`, `endSession()`, `throw error`

---

### 5b. `getPurchaseReturn`

Supports: pagination, sorting, multi-field search, date range.

Query params:
```
?supplierId=<ObjectId>
&supplierName=<string>         ← requires $lookup / populate + filter
&productName=<string>          ← text search on products[]
&variantName=<string>          ← text search on variants[]
&returnDate=<YYYY-MM-DD>       ← exact date match (strip time)
&startDate=<YYYY-MM-DD>
&endDate=<YYYY-MM-DD>
&page=<int>   (default: 1)
&limit=<int>  (default: 20)
&sort=<field> (default: -createdAt)
```

**Implementation notes:**
- `supplierId` (ObjectId) → filter directly on `supplier` field
- `supplierName` → `$lookup` supplier, filter by `supplierName` regex, or use a two-step approach: find matching supplier `_id`s first, then filter
- `productName` / `variantName` → lookup the relevant model first, get `_id`s, then filter `products.product` / `products.variant`
- `returnDate` → `$gte: startOfDay`, `$lt: endOfNextDay`
- `startDate` + `endDate` → `returnDate: { $gte: start, $lte: end }`

Cache key: `buildCacheKey(NS, `list:${JSON.stringify(queryParams)}`)` — only cache simple queries without text search, or skip cache for search queries to keep it simple.

Populate: `supplier` (name, supplierId), `products.product` (name, stock), `products.variant` (variantName, stockVariant)

Empty result: follow rule 10 from Workflow — `apiResponse.sendSuccess(res, statusCodes.OK, "Purchase return not found", { purchaseReturns: [], fromCache: false })`

---

### 5c. `updatePurchaseReturn`

Update requires reversing old inventory/supplier changes and applying new ones — same two-step pattern as `updatePurchase` in `purchase.controller.js`.

Flow:
1. Fetch existing `PurchaseReturn` document
2. **Revert old stock**: batch `$inc: { stock: +oldQuantity, purchaseReturnStock: -oldQuantity }` for old products; same for variants
3. **Revert old supplier dues**: add `oldTotalReturnAmount` back to supplier dues
4. **Validate new payload** stock availability (same check as create)
5. **Apply new stock**: batch `$inc` for new products/variants
6. **Apply new supplier dues**: subtract `newTotalReturnAmount`
7. Update the `PurchaseReturn` document fields
8. Commit

---

### 5d. `deletePurchaseReturn`

Flow:
1. Fetch existing document
2. Revert stock: `$inc: { stock: +quantity, purchaseReturnStock: -quantity }` for products; same for variants
3. Revert supplier dues: add `totalReturnAmount` back (floor at 0)
4. `findByIdAndDelete` the document
5. Commit

---

## 6. Routes: `purchase-return.api.js`

Follow `ApiConvention.md` — new routes use `:id` (no slug on this model).

```
POST   /purchase-return               createPurchaseReturn
GET    /purchase-return               getPurchaseReturn  (with query params)
GET    /purchase-return/:id           getSinglePurchaseReturn  (optional, for detail view)
PUT    /purchase-return/:id           updatePurchaseReturn
DELETE /purchase-return/:id           deletePurchaseReturn
```

Register in `src/routes/index.js`:
```js
_.use("/purchase-return", require("./api/purchase-return.api"));
```

Auth guards: add as commented lines (same pattern as the rest of the codebase).

---

## 7. Frontend: `PurchaseReturnForm.tsx`

### State Shape

```ts
interface ReturnItem {
  product: string;       // Product _id
  variant: string | null;
  productName: string;   // display only
  purchasePrice: number;
  availableStock: number;
  quantity: number;
  subtotal: number;      // purchasePrice × quantity
}

interface FormState {
  supplier: string | null;      // Supplier _id
  supplierName: string;         // display only
  openingDues: number;
  returnDate: string;
  remarks: string;
  items: ReturnItem[];
  totalReturnAmount: number;
}
```

---

### Component Sections

#### Section 1 — Supplier Search

- Input: text field, user types `supplierId` (mobile number)
- On submit/debounce: `GET /supplier/getsuppliers?supplierId=<value>`
- On result: populate `supplier._id`, `supplierName`, `openingDues` in state
- Display: supplier card showing name, mobile, current dues

#### Section 2 — Product/Variant Search

- Input: text field, user types product or variant name
- On input: `GET /sales/get-sales-products?q=<value>`
- On select from dropdown: add item to `items[]`
  - Set `product`, `variant`, `purchasePrice`, `availableStock`, `productName`
  - Initialize `quantity = 1`, `subtotal = purchasePrice × 1`
- Prevent duplicate: if same `product`+`variant` combo already in list, skip

#### Section 3 — Return Items Table

Columns: **Product/Variant Name | Purchase Price | Available Stock | Quantity | Subtotal | Remove**

- Quantity input: number field, `min=1`, `max=availableStock`
- On quantity change:
  - Validate `quantity <= availableStock` — show inline error if exceeded
  - Recalculate `subtotal = purchasePrice × quantity`
  - Recalculate `totalReturnAmount = Σ subtotals`
- Remove button: removes item from list

#### Section 4 — Summary Panel

Displayed below the table:

```
Opening Dues:                ৳ 38,234
Total Return Amount:         ৳  9,400
Remaining Due After Return:  ৳ 28,834
```

- `remainingDue = openingDues - totalReturnAmount`
- All values update in real time

#### Section 5 — Additional Fields

- `returnDate`: date input (default today)
- `remarks`: textarea (optional)

---

### Submit

Payload assembled from state:
```json
{
  "supplier": "<_id>",
  "returnDate": "2026-06-17",
  "remarks": "Damaged materials",
  "totalReturnAmount": 9400,
  "products": [
    { "product": "...", "variant": null,  "quantity": 5, "purchasePrice": 800,  "subtotal": 4000 },
    { "product": "...", "variant": "...", "quantity": 3, "purchasePrice": 1000, "subtotal": 3000 }
  ]
}
```

Validation before submit:
1. `supplier` must be selected
2. `items` must be non-empty
3. No item `quantity > availableStock`
4. `returnDate` must be set

On success: clear form, show success toast.
On error: display error message from API response.

---

## 8. Business Logic Summary

| Step | What happens |
|------|-------------|
| User selects supplier | `openingDues` displayed, used for due preview |
| User selects product/variant | `purchasePrice` and `availableStock` auto-filled |
| User enters quantity | `subtotal` and `totalReturnAmount` recalculate live |
| User submits | Backend transaction: create return doc → validate stock → bulk-update stock → update supplier dues → commit |
| On rollback | Any failure aborts everything — no partial state |

---

## 9. Edge Cases to Handle

| Case | Handling |
|------|----------|
| Return quantity > available stock | Block at frontend (validation) AND backend (throw 400) |
| Supplier not found by ID | Return empty array, show "Supplier not found" |
| Product has no variants (singleVariant) | `variant = null` in payload, update `product.stock` only |
| Supplier dues go below 0 | `Math.max(0, dues - returnAmount)` — floor at 0 |
| Same product added twice in UI | Prevent duplicate entries in `items[]` |
| Network failure mid-transaction | MongoDB aborts, no partial writes |
| `totalPurchaseDue` missing on old supplier docs | Default 0 handles it — field has `default: 0` |

---

## 10. Implementation Order

1. Add `purchaseReturnStock` to `product.model.js` and `variant.model.js`
2. Add `totalPurchaseDue` to `supplier.model.js`
3. Create `purchaseReturn.model.js`
4. Create `purchaseReturn.controller.js` (start with `createPurchaseReturn`, then get/update/delete)
5. Create `purchase-return.api.js` routes
6. Register route in `src/routes/index.js`
7. Build `PurchaseReturnForm.tsx` (supplier search → product search → table → summary → submit)

---

## 11. What NOT to Do

- Do not call `cloudinaryFileUpload()` — no images in this module
- Do not skip `asynchandeler` wrapper on any controller function
- Do not use raw status code numbers — use `statusCodes.*`
- Do not set `slug` manually — `PurchaseReturn` has no slug
- Do not implement v2 schema changes (embedded variants, self-referential Category)
- Do not loop N individual `findById` + `save` calls — use `bulkWrite` for stock updates
- Do not allow `quantity` to exceed available stock (validate both client and server)
