# Purchase Module — Frontend Integration Plan

**Base URL:** `{{BaseUrl}}/api/v1/purchase`  
**Auth:** Currently commented out — all routes are public  
**Content-Type:** `application/json`

---

## API Endpoints Overview

| # | Method | Endpoint | Action |
|---|---|---|---|
| 1 | POST | `/purchase/add-purchase` | Create new purchase |
| 2 | GET | `/purchase/all-allpurchases` | Get all purchases |
| 3 | GET | `/purchase/search-purchase` | Search by invoiceNumber / supplierId / cashType |
| 4 | GET | `/purchase/single-purchase/:id` | Get single purchase |
| 5 | PUT | `/purchase/update-purchase/:id` | Update purchase |
| 6 | DELETE | `/purchase/delete-purchase/:id` | Delete purchase |

---

## 1. CREATE PURCHASE

**`POST /purchase/add-purchase`**

### Request Body

```json
{
  "invoiceNumber": "INV-2026-001",
  "supplierId": "664f1a2b3c4d5e6f7a8b9c0d",
  "cashType": "664f1a2b3c4d5e6f7a8b9c0e",
  "category": "664f1a2b3c4d5e6f7a8b9c0f",
  "subCategory": "664f1a2b3c4d5e6f7a8b9c10",
  "brand": "664f1a2b3c4d5e6f7a8b9c11",
  "allproduct": [
    {
      "product": "664f1a2b3c4d5e6f7a8b9c12",
      "variant": null,
      "purchasePrice": 500,
      "retailPrice": 800,
      "wholesalePrice": 650,
      "quantity": 10,
      "size": "L",
      "color": "Red"
    },
    {
      "product": null,
      "variant": "664f1a2b3c4d5e6f7a8b9c13",
      "purchasePrice": 300,
      "retailPrice": 500,
      "wholesalePrice": 400,
      "quantity": 5,
      "size": "M",
      "color": "Blue"
    }
  ],
  "subTotal": 6500,
  "commission": 200,
  "shipping": 150,
  "payable": 6850,
  "paid": 5000,
  "dueamount": 1850
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `invoiceNumber` | string | ✅ | Must be unique across all purchases |
| `supplierId` | ObjectId | ✅ | Ref → Supplier. If `dueamount > 0`, supplier's `openingDues` is incremented |
| `cashType` | ObjectId | ❌ | Ref → Account (cash account used for this purchase) |
| `category` | ObjectId | ❌ | Ref → Category |
| `subCategory` | ObjectId | ❌ | Ref → Subcategory |
| `brand` | ObjectId | ❌ | Ref → Brand |
| `allproduct` | array | ✅ | Min 1 item required |
| `allproduct[].product` | ObjectId\|null | ❌ | Ref → Product. Send `product` OR `variant`, not both |
| `allproduct[].variant` | ObjectId\|null | ❌ | Ref → Variant |
| `allproduct[].purchasePrice` | number | ✅ | Price paid per unit |
| `allproduct[].retailPrice` | number | ✅ | Selling price per unit |
| `allproduct[].wholesalePrice` | number | ❌ | Wholesale price per unit |
| `allproduct[].quantity` | number | ✅ | Min 1. Stock is incremented by this value |
| `allproduct[].size` | string | ❌ | Updates product/variant size field |
| `allproduct[].color` | string | ❌ | Updates product/variant color field |
| `subTotal` | number | ❌ | Sum of (purchasePrice × quantity) for all items — frontend should calculate |
| `commission` | number | ❌ | Default 0 |
| `shipping` | number | ❌ | Default 0 |
| `payable` | number | ❌ | `subTotal + commission + shipping` — frontend should calculate |
| `paid` | number | ❌ | Amount paid upfront. Default 0 |
| `dueamount` | number | ❌ | `payable - paid` — frontend should calculate. If > 0, added to supplier dues |

### Side Effects (Backend handles automatically)
- Each `product` item → `Product.stock += quantity`
- Each `variant` item → `Variant.stockVariant += quantity`
- Each `product` item → updates `purchasePrice`, `retailPrice`, `wholesalePrice`, `size`, `color` on the Product document
- Each `variant` item → updates same fields on the Variant document
- If `dueamount !== 0` → `Supplier.openingDues += dueamount`
- Runs inside a MongoDB transaction — all or nothing

### Success Response `201`

```json
{
  "statusCode": 201,
  "message": "Purchase created successfully",
  "data": "INV-2026-001"
}
```

> **Note:** Response returns `invoiceNumber` string, not the full purchase object.

### Error Responses

| Status | Message |
|---|---|
| 400 | "At least one product or variant is required" |
| 400 | "Invoice Number already exists" (pre-save hook) |

---

## 2. GET ALL PURCHASES

**`GET /purchase/all-allpurchases`**

No query params. Returns all purchases sorted by `createdAt` descending.

### Success Response `200`

```json
{
  "statusCode": 200,
  "message": "Purchases fetched successfully",
  "data": [
    {
      "serial": "PUR-SI-01",
      "_id": "...",
      "invoiceNumber": "INV-2026-001",
      "date": "2026-05-24T...",
      "supplierId": {
        "_id": "...",
        "name": "Supplier Name",
        ...
      },
      "cashType": {
        "_id": "...",
        "name": "Cash",
        ...
      },
      "allproduct": [
        {
          "product": { "_id": "...", "name": "...", ... },
          "variant": null,
          "purchasePrice": 500,
          "retailPrice": 800,
          "wholesalePrice": 650,
          "quantity": 10,
          "subTotal": 5000,
          "size": "L",
          "color": "Red"
        }
      ],
      "subTotal": 5000,
      "commission": 200,
      "shipping": 150,
      "payable": 5350,
      "paid": 5000,
      "dueamount": 350,
      "category": { "_id": "...", "name": "..." },
      "subCategory": { "_id": "...", "name": "..." },
      "brand": { "_id": "...", "name": "..." },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

> **Note:** `serial` is generated as `PUR-SI-01`, `PUR-SI-02`, etc. based on index in sorted result — not stored in DB.  
> Populated fields: `supplierId`, `cashType`, `category`, `subCategory`, `brand`, `allproduct.product`, `allproduct.variant`

---

## 3. SEARCH PURCHASES

**`GET /purchase/search-purchase`**

At least one query param required.

| Param | Type | Match |
|---|---|---|
| `invoiceNumber` | string | Partial, case-insensitive |
| `supplierId` | ObjectId string | Exact match |
| `cashType` | ObjectId string | Exact match |

### Examples

```
GET /purchase/search-purchase?invoiceNumber=INV-2026
GET /purchase/search-purchase?supplierId=664f1a2b3c4d5e6f7a8b9c0d
GET /purchase/search-purchase?cashType=664f1a2b3c4d5e6f7a8b9c0e
GET /purchase/search-purchase?supplierId=664f...&cashType=664f...
```

### Success Response `200`

```json
{
  "statusCode": 200,
  "message": "Purchases fetched successfully",
  "data": {
    "purchases": [ ...fullPurchaseObjects ],
    "total": 3,
    "fromCache": false
  }
}
```

### Empty Response `200`

```json
{
  "statusCode": 200,
  "message": "No purchases found",
  "data": {
    "purchases": [],
    "total": 0,
    "fromCache": false
  }
}
```

### Error Responses

| Status | Message |
|---|---|
| 400 | "At least one search param is required (invoiceNumber, supplierId, cashType)" |
| 400 | "Invalid supplierId" |
| 400 | "Invalid cashType id" |

---

## 4. GET SINGLE PURCHASE

**`GET /purchase/single-purchase/:id`**

`:id` = MongoDB `_id` of the purchase document.

### Example

```
GET /purchase/single-purchase/664f1a2b3c4d5e6f7a8b9c0d
```

### Success Response `200`

```json
{
  "statusCode": 200,
  "message": "Purchase fetched successfully",
  "data": {
    "purchase": {
      "_id": "664f1a2b3c4d5e6f7a8b9c0d",
      "invoiceNumber": "INV-2026-001",
      "supplierId": { "_id": "...", "name": "...", ... },
      "cashType": { "_id": "...", "name": "...", ... },
      "allproduct": [
        {
          "product": { "_id": "...", "name": "...", ... },
          "variant": null,
          "purchasePrice": 500,
          "retailPrice": 800,
          "wholesalePrice": 650,
          "quantity": 10,
          "subTotal": 5000,
          "size": "L",
          "color": "Red"
        }
      ],
      "subTotal": 5000,
      "commission": 200,
      "shipping": 150,
      "payable": 5350,
      "paid": 5000,
      "dueamount": 350,
      "category": { "_id": "...", "name": "...", ... },
      "subCategory": { "_id": "...", "name": "...", ... },
      "brand": { "_id": "...", "name": "...", ... },
      "createdAt": "...",
      "updatedAt": "..."
    },
    "fromCache": true
  }
}
```

### Error Responses

| Status | Message |
|---|---|
| 400 | "ID is required" |
| 404 | "Purchase not found" |

---

## 5. UPDATE PURCHASE

**`PUT /purchase/update-purchase/:id`**

`:id` = MongoDB `_id` of the purchase.

### Request Body

Same shape as Create. All fields are accepted.

```json
{
  "invoiceNumber": "INV-2026-001-REVISED",
  "supplierId": "664f1a2b3c4d5e6f7a8b9c0d",
  "cashType": "664f1a2b3c4d5e6f7a8b9c0e",
  "category": "664f1a2b3c4d5e6f7a8b9c0f",
  "subCategory": "664f1a2b3c4d5e6f7a8b9c10",
  "brand": "664f1a2b3c4d5e6f7a8b9c11",
  "allproduct": [
    {
      "product": "664f1a2b3c4d5e6f7a8b9c12",
      "variant": null,
      "purchasePrice": 550,
      "retailPrice": 850,
      "wholesalePrice": 700,
      "quantity": 12,
      "size": "XL",
      "color": "Green"
    }
  ],
  "subTotal": 6600,
  "commission": 200,
  "shipping": 150,
  "payable": 6950,
  "paid": 5000,
  "dueamount": 1950
}
```

### Side Effects (Backend handles automatically)
- **Old stock is reverted first:** each previous product/variant has quantity subtracted
- **Old supplier dues reverted:** old `dueamount` subtracted from `Supplier.openingDues`
- **New stock applied:** new quantities added to product/variant stock
- **New supplier dues applied:** new `dueamount` added to `Supplier.openingDues`
- All operations run inside a MongoDB transaction — all or nothing

### Field Fallback Behavior

| Field | If not sent in body |
|---|---|
| `invoiceNumber` | Keeps existing value |
| `supplierId` | Keeps existing value |
| `cashType` | Keeps existing value |
| `category` | Keeps existing value |
| `subCategory` | Keeps existing value |
| `brand` | Keeps existing value |
| `payable` | Keeps existing value |
| `dueamount` | Keeps existing value |
| `commission` | Resets to 0 (has default) |
| `shipping` | Resets to 0 (has default) |
| `paid` | Resets to 0 (has default) |
| `allproduct` | Required — must always send full array |

### Success Response `200`

```json
{
  "statusCode": 200,
  "message": "Purchase updated successfully",
  "data": { ...updatedPurchaseObject }
}
```

### Error Responses

| Status | Message |
|---|---|
| 404 | "Purchase not found" |

---

## 6. DELETE PURCHASE

**`DELETE /purchase/delete-purchase/:id`**

`:id` = MongoDB `_id` of the purchase.

### Example

```
DELETE /purchase/delete-purchase/664f1a2b3c4d5e6f7a8b9c0d
```

### Side Effects (Backend handles automatically)
- Each product's `stock` decremented by original `quantity`
- Each variant's `stockVariant` decremented by original `quantity`
- If `dueamount !== 0` → `Supplier.openingDues` decremented accordingly
- All inside a transaction

### Success Response `200`

```json
{
  "statusCode": 200,
  "message": "Purchase deleted successfully",
  "data": null
}
```

### Error Responses

| Status | Message |
|---|---|
| 404 | "Purchase not found" |

---

## Data Flow — Frontend Calculation Guide

The backend does **not** auto-calculate financial totals — frontend must compute and send them.

```
subTotal   = sum of (item.purchasePrice × item.quantity) for all items
payable    = subTotal + commission + shipping
dueamount  = payable - paid
```

### Example

```js
const subTotal = allproduct.reduce((acc, item) => acc + item.purchasePrice * item.quantity, 0);
const payable  = subTotal + commission + shipping;
const dueamount = payable - paid;
```

---

## Populated References in Responses

All GET endpoints return fully populated objects:

| Field | Populated From |
|---|---|
| `supplierId` | Supplier collection |
| `cashType` | Account collection |
| `category` | Category collection |
| `subCategory` | Subcategory collection |
| `brand` | Brand collection |
| `allproduct[].product` | Product collection |
| `allproduct[].variant` | Variant collection |

---

## Cache Behavior

| Endpoint | Cache |
|---|---|
| `GET /all-allpurchases` | Cached under `purchase:all` — 1 hour TTL |
| `GET /single-purchase/:id` | Cached under `purchase:id:<id>` — 1 hour TTL |
| `GET /search-purchase` | Cached under `purchase:search:<filters>` — 1 hour TTL |
| POST / PUT / DELETE | Calls `bumpNsVersion("purchase")` → invalidates all purchase cache |

---

## Frontend Integration Checklist

### Create Purchase Form
- [ ] Input: `invoiceNumber` (unique, required)
- [ ] Dropdown: `supplierId` — fetch from `GET /supplier`
- [ ] Dropdown: `cashType` — fetch from `GET /account`
- [ ] Dropdown: `category`, `subCategory`, `brand` (optional)
- [ ] Dynamic product rows — each row: product OR variant selector, purchasePrice, retailPrice, wholesalePrice, quantity, size, color
- [ ] Auto-calculate `subTotal`, `payable`, `dueamount` on every row change
- [ ] Input: `commission`, `shipping`, `paid`
- [ ] Submit: POST with full body including calculated totals

### Purchase List Page
- [ ] Fetch `GET /all-allpurchases` on mount
- [ ] Display `serial` (PUR-SI-01...) from response
- [ ] Display supplier name from `supplierId.name`
- [ ] Display account name from `cashType.name`
- [ ] Search bar → calls `GET /search-purchase?invoiceNumber=<input>`
- [ ] Filter by supplier → `GET /search-purchase?supplierId=<id>`
- [ ] Filter by cash account → `GET /search-purchase?cashType=<id>`

### Purchase Detail / Edit Page
- [ ] Fetch `GET /single-purchase/:id` on mount
- [ ] Pre-fill all form fields with existing data
- [ ] Re-calculate totals if any row changes
- [ ] Submit: PUT `/update-purchase/:id` — always send full `allproduct` array
- [ ] Delete: DELETE `/delete-purchase/:id` — confirm before calling

### Important Frontend Rules
1. **Always send the full `allproduct` array on update** — partial arrays will revert stock incorrectly
2. **Calculate `subTotal`, `payable`, `dueamount` on the frontend** — backend uses the values you send
3. **`dueamount` drives supplier dues** — if you send wrong value, supplier balance will be wrong
4. **Create returns `invoiceNumber` string, not the full object** — use it to confirm creation, then refetch list if needed

---

## Error Response Shape

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "status": "Client Error",
  "isOperationalError": true,
  "data": null
}
```

Status codes used: `200` success, `201` created, `400` bad request, `404` not found, `500` server error.
