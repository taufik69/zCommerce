const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  buildCacheKey,
} = require("@/utils/cache.util");
const salesModel = require("../models/sales.model");
const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const { customerModel } = require("../models/customer.model");
const { SupplierModel } = require("../models/supplier.model");
const employeeModel = require("../models/employee.model");
const crateTransactionModel = require("../models/crateTransaction.model");

const NS = "dashboard";
const CACHE_TTL = 2 * 60; // 2 minutes — dashboard tolerates slight staleness

// Resolve the requested window (?range=today|7d|30d|90d|12m|all). Defaults to 30d.
const resolveRange = (range) => {
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "90d":
      start.setDate(now.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "12m":
      start.setMonth(now.getMonth() - 11, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
      return { start: null, end: now, key: "all" };
    case "30d":
    default:
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end: now, key: "30d" };
  }
  return { start, end: now, key: range };
};

// @desc  aggregated dashboard overview — one call, many widgets
exports.getOverview = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(req.query.range);

  const cacheKey = await buildCacheKey(NS, `overview:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Dashboard fetched", {
      ...cached,
      fromCache: true,
    });
  }

  // Match filter for time-bounded sales queries
  const dateMatch = start ? { createdAt: { $gte: start, $lte: end } } : {};

  // "Today" window — independent of the range selector (summary cards below)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMatch = { createdAt: { $gte: todayStart } };

  const [
    salesAgg,
    salesByType,
    paymentSplit,
    dailySeries,
    topProducts,
    recentSales,
    catalogCounts,
    stockValueAgg,
    variantStockAgg,
    lowStockProducts,
    customerCount,
    duesAgg,
    supplierCount,
    employeeCount,
    salesTodayAgg,
    cashTodayAgg,
    supplierDuesAgg,
  ] = await Promise.all([
    // 1. Headline sales KPIs within range
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$payable" },
          collected: { $sum: "$paid" },
          dues: { $sum: "$presentDue" },
          orders: { $sum: 1 },
          itemsSold: { $sum: { $sum: "$searchItem.quantity" } },
        },
      },
    ]),

    // 2. Sales grouped by type (retail / wholesale / orders)
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$salesType",
          revenue: { $sum: "$payable" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 3. Payment status split
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          amount: { $sum: "$payable" },
        },
      },
    ]),

    // 4. Daily revenue series for the trend chart
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$payable" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 5. Top selling products by quantity within range
    salesModel.aggregate([
      { $match: dateMatch },
      { $unwind: "$searchItem" },
      {
        $group: {
          _id: "$searchItem.productDescription",
          quantity: { $sum: "$searchItem.quantity" },
          revenue: { $sum: "$searchItem.subtotal" },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 7 },
    ]),

    // 6. Recent sales feed
    salesModel
      .find(dateMatch)
      .sort({ createdAt: -1 })
      .limit(8)
      .select(
        "invoiceNumber payable paid presentDue paymentStatus salesType customerType createdAt",
      )
      .lean(),

    // 7. Catalog counts (not range-bound)
    Promise.all([
      productModel.countDocuments({ isActive: true }),
      productModel.countDocuments({}),
    ]),

    // 8. Product-level inventory valuation (single-variant products)
    productModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stock" },
          retailValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$retailPrice", 0] }] },
          },
          costValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$purchasePrice", 0] }] },
          },
        },
      },
    ]),

    // 9. Variant-level inventory valuation
    variantModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stockVariant" },
          retailValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$retailPrice", 0] }],
            },
          },
          costValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$purchasePrice", 0] }],
            },
          },
        },
      },
    ]),

    // 10. Low-stock products (<= 5 units, active)
    productModel
      .find({ isActive: true, stock: { $lte: 5 } })
      .sort({ stock: 1 })
      .limit(8)
      .select("name stock retailPrice barCode")
      .lean(),

    // 11. Total customers
    customerModel.countDocuments({}),

    // 12. Outstanding customer dues across all sales (not range-bound)
    salesModel.aggregate([
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$presentDue" },
        },
      },
    ]),

    // 13. Total suppliers (not soft-deleted)
    SupplierModel.countDocuments({ deletedAt: null }),

    // 14. Total employees
    employeeModel.countDocuments({}),

    // 15. Today's sales breakdown (payable / paid / due)
    salesModel.aggregate([
      { $match: todayMatch },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$payable" },
          cashSales: { $sum: "$paid" },
          duesSales: { $sum: "$presentDue" },
        },
      },
    ]),

    // 16. Today's cash transactions grouped by type
    crateTransactionModel.aggregate([
      { $match: todayMatch },
      {
        $group: {
          _id: "$transactionType",
          amount: { $sum: "$amount" },
        },
      },
    ]),

    // 17. Overall supplier dues (opening + purchase due)
    SupplierModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalDue: {
            $sum: {
              $add: [
                { $ifNull: ["$openingDues", 0] },
                { $ifNull: ["$totalPurchaseDue", 0] },
              ],
            },
          },
        },
      },
    ]),
  ]);

  const s = salesAgg[0] || {
    revenue: 0,
    collected: 0,
    dues: 0,
    orders: 0,
    itemsSold: 0,
  };
  const pv = stockValueAgg[0] || { units: 0, retailValue: 0, costValue: 0 };
  const vv = variantStockAgg[0] || { units: 0, retailValue: 0, costValue: 0 };

  const payload = {
    range: key,
    kpis: {
      revenue: Math.round(s.revenue || 0),
      collected: Math.round(s.collected || 0),
      dues: Math.round(s.dues || 0),
      orders: s.orders || 0,
      itemsSold: s.itemsSold || 0,
      avgOrderValue: s.orders ? Math.round((s.revenue || 0) / s.orders) : 0,
      totalCustomers: customerCount || 0,
      activeProducts: catalogCounts[0] || 0,
      totalProducts: catalogCounts[1] || 0,
      inventoryUnits: (pv.units || 0) + (vv.units || 0),
      inventoryRetailValue: Math.round(
        (pv.retailValue || 0) + (vv.retailValue || 0),
      ),
      inventoryCostValue: Math.round(
        (pv.costValue || 0) + (vv.costValue || 0),
      ),
      outstandingDues: Math.round(duesAgg[0]?.totalDue || 0),
    },
    summary: (() => {
      const st = salesTodayAgg[0] || {
        totalSales: 0,
        cashSales: 0,
        duesSales: 0,
      };
      const cashReceive = Math.round(
        cashTodayAgg.find((c) => c._id === "cash recived")?.amount || 0,
      );
      const cashPayment = Math.round(
        cashTodayAgg.find((c) => c._id === "cash payment")?.amount || 0,
      );
      const supplierDues = Math.round(supplierDuesAgg[0]?.totalDue || 0);
      const customerDues = Math.round(duesAgg[0]?.totalDue || 0);
      return {
        profile: {
          totalCustomer: customerCount || 0,
          totalSupplier: supplierCount || 0,
          totalEmployee: employeeCount || 0,
        },
        salesToday: {
          totalSales: Math.round(st.totalSales || 0),
          cashSales: Math.round(st.cashSales || 0),
          duesSales: Math.round(st.duesSales || 0),
        },
        cashToday: {
          cashReceive,
          cashPayment,
          cashBalance: cashReceive - cashPayment,
        },
        overallBalance: {
          supplierDues,
          customerDues,
          liabilityBalance: supplierDues - customerDues,
        },
      };
    })(),
    salesByType: salesByType.map((t) => ({
      type: t._id || "unknown",
      revenue: Math.round(t.revenue || 0),
      count: t.count || 0,
    })),
    paymentSplit: paymentSplit.map((p) => ({
      status: p._id || "unknown",
      count: p.count || 0,
      amount: Math.round(p.amount || 0),
    })),
    dailySeries: dailySeries.map((d) => ({
      date: d._id,
      revenue: Math.round(d.revenue || 0),
      orders: d.orders || 0,
    })),
    topProducts: topProducts.map((p) => ({
      name: p._id || "Unnamed",
      quantity: p.quantity || 0,
      revenue: Math.round(p.revenue || 0),
    })),
    recentSales: recentSales.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      payable: Math.round(r.payable || 0),
      paid: Math.round(r.paid || 0),
      presentDue: Math.round(r.presentDue || 0),
      paymentStatus: r.paymentStatus,
      salesType: r.salesType,
      customerName:
        r.customerType?.walking?.customerName ||
        (r.customerType?.type === "listed" ? "Listed customer" : "Walking"),
      createdAt: r.createdAt,
    })),
    lowStock: lowStockProducts.map((p) => ({
      name: p.name,
      stock: p.stock ?? 0,
      retailPrice: Math.round(p.retailPrice || 0),
      barCode: p.barCode || "",
    })),
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Dashboard fetched", {
    ...payload,
    fromCache: false,
  });
});
