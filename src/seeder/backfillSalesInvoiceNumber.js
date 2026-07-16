require("dotenv").config();
require("module-alias/register");
const mongoose = require("mongoose");
const Sales = require("../models/sales.model");
const Counter = require("../models/counter.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Renumbers every existing sale to the INV-SI-01 format, oldest sale first, and
// leaves the SALES_INVOICE counter parked on the highest number issued so new
// sales continue the sequence.
//
// This REWRITES invoiceNumber on existing sales. Old printed invoices and any
// external record referencing the previous INV-000001 format will no longer
// match. Run --dry first.
async function backfillSalesInvoiceNumber({ dryRun }) {
  const prefix = process.env.INVOICE_PREFIX || "INV";

  // Oldest first, so the oldest sale becomes -01.
  const sales = await Sales.find({})
    .sort({ createdAt: 1 })
    .select("_id invoiceNumber createdAt")
    .lean();

  if (sales.length === 0) {
    console.log("No sales found — nothing to backfill.");
    return { total: 0, updated: 0, skipped: 0 };
  }

  console.log(`Found ${sales.length} sale(s).`);

  let seq = 0;
  let updated = 0;
  let skipped = 0;

  for (const sale of sales) {
    seq += 1;
    const next = `${prefix}-SI-${String(seq).padStart(2, "0")}`;

    if (sale.invoiceNumber === next) {
      skipped += 1;
      continue;
    }

    console.log(
      `  ${dryRun ? "[dry]" : "     "} ${sale.invoiceNumber || "(none)"} -> ${next}`,
    );

    if (!dryRun) {
      await Sales.updateOne({ _id: sale._id }, { $set: { invoiceNumber: next } });
      updated += 1;
    }
  }

  if (!dryRun) {
    // Park the counter at the last number issued so the next sale is seq + 1.
    await Counter.findOneAndUpdate(
      { key: "SALES_INVOICE" },
      { $set: { seq } },
      { upsert: true },
    );
    console.log(`Counter SALES_INVOICE set to ${seq} — next sale: ${prefix}-SI-${String(seq + 1).padStart(2, "0")}`);
    await bumpNsVersion("sales");
  }

  return { total: sales.length, updated, skipped };
}

(async () => {
  const dryRun = process.argv.includes("--dry");

  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log(`Connected.${dryRun ? " DRY RUN — no writes." : ""}`);

    const { total, updated, skipped } = await backfillSalesInvoiceNumber({ dryRun });

    console.log(
      dryRun
        ? `\nDry run complete. ${total} sale(s) would be renumbered. Re-run without --dry to apply.`
        : `\nDone. total=${total} updated=${updated} already-correct=${skipped}`,
    );
  } catch (err) {
    console.error("Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
