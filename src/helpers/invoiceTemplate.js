// Builds an HTML invoice email that mirrors the frontend SalesInvoicePrint
// design (header, bill-to / details / invoice-no block, items table, payment +
// totals). Uses inline styles and a table-based layout because email clients
// strip <style> blocks and don't support fl/grid reliably.

const salesTypeLabel = {
  wholesale: "Wholesale",
  retailsale: "Retail Sale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

const money = (n = 0) =>
  `৳ ${Math.round(Number(n || 0)).toLocaleString("en-US")}`;

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtTime = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  let h = dt.getHours();
  const m = String(dt.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
};

function customerFields(sale) {
  const ct = sale.customerType || {};
  if (ct.type === "listed" && ct.customerId) {
    const c = ct.customerId;
    return {
      name: c.fullName || "",
      mobile: c.mobileNumber || "",
      address: c.presentAddress || "",
      email: c.emailAddress || c.email || "",
    };
  }
  const w = ct.walking || {};
  return {
    name: w.customerName || "",
    mobile: w.mobileNumber || "",
    address: w.address || "",
    email: w.email || "",
  };
}

function paymentRows(sale) {
  const pm = sale.paymentMethod || {};
  const rows = [];
  const accName = (p) =>
    (p?.paymentTo && (p.paymentTo.name || p.paymentTo)) || "Cash";
  if (pm.singlePayment && (pm.singlePayment.amount ?? 0) > 0) {
    rows.push({ name: accName(pm.singlePayment), amount: pm.singlePayment.amount });
  }
  (pm.multiplePayment || []).forEach((p) => {
    if ((p?.amount ?? 0) > 0) rows.push({ name: accName(p), amount: p.amount });
  });
  return rows;
}

function buildInvoiceHtml(sale, store) {
  const cust = customerFields(sale);
  const items = sale.searchItem || [];
  const payments = paymentRows(sale);

  const subTotal = Number(sale.total || 0);
  const discountAmt = (subTotal * Number(sale.discountPercent || 0)) / 100;
  const vatAmt =
    ((subTotal - discountAmt) * Number(sale.vatPercent || 0)) / 100;

  const salesman = sale.salesMen || {};
  const salesmanName = salesman.fullName || "";
  const salesmanId = salesman.employeeId || "";

  const storeName = esc(store?.storeName || "Store");
  const storeAddress = esc(store?.adress || "");
  const storePhone = esc(store?.phone || "");
  const storeFooter = esc(store?.footer || "");

  const itemRows =
    items.length === 0
      ? `<tr><td colspan="5" style="padding:24px;text-align:center;font-size:10px;color:#9ca3af;">No items on this invoice.</td></tr>`
      : items
          .map((item, i) => {
            const details = [
              item.color ? `Color: ${esc(item.color)}` : null,
              item.size ? `Size: ${esc(item.size)}` : null,
            ]
              .filter(Boolean)
              .join(" | ");
            return `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px;font-size:9px;color:#9ca3af;vertical-align:top;">${i + 1}</td>
              <td style="padding:8px;vertical-align:top;">
                <div style="font-size:10px;font-weight:bold;color:#374151;">
                  ${esc(item.productDescription || "—")}${
                    item.barcode
                      ? ` <span style="font-weight:normal;color:#9ca3af;">| ${esc(item.barcode)}</span>`
                      : ""
                  }
                </div>
                ${
                  details
                    ? `<div style="font-size:8px;color:#9ca3af;">${details}</div>`
                    : ""
                }
              </td>
              <td style="padding:8px;text-align:right;font-size:9px;color:#6b7280;vertical-align:top;">${item.quantity ?? 0}${item.unit ? ` ${esc(item.unit)}` : ""}</td>
              <td style="padding:8px;text-align:right;font-size:10px;vertical-align:top;">${money(item.salesRate)}</td>
              <td style="padding:8px;text-align:right;font-size:10px;font-weight:bold;vertical-align:top;">${money(item.subtotal)}</td>
            </tr>`;
          })
          .join("");

  const paymentLines =
    payments.length === 0
      ? `<div style="font-size:9px;color:#9ca3af;">No payment recorded.</div>`
      : payments
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;font-size:9px;color:#6b7280;"><span>${esc(p.name)}</span><span>${money(p.amount)}</span></div>`,
          )
          .join("");

  const totalRow = (label, value) =>
    `<tr><td style="padding:2px 0;font-size:10px;color:#6b7280;">${label}</td><td style="padding:2px 0;font-size:10px;text-align:right;">${value}</td></tr>`;

  return `<!doctype html>
<html>
<body style="margin:0;padding:16px;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;color:#374151;padding:28px 32px;">

    <!-- Header -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="text-align:right;">
          <div style="font-size:24px;font-weight:800;color:#4b5563;line-height:1;">INVOICE</div>
          <div style="font-size:14px;font-weight:bold;margin-top:6px;">${storeName}</div>
          ${storeAddress ? `<div style="font-size:9px;color:#6b7280;">${storeAddress}</div>` : ""}
          ${storePhone ? `<div style="font-size:9px;color:#6b7280;">Tel: ${storePhone}</div>` : ""}
        </td>
      </tr>
    </table>

    <div style="border-top:2px solid #9ca3af;margin-top:16px;"></div>

    <!-- Bill to / details / invoice no -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:0;">
      <tr>
        <td style="width:33%;padding:12px;vertical-align:top;">
          <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#6b7280;margin-bottom:6px;">BILL TO</div>
          <div style="font-size:12px;font-weight:bold;">${esc(cust.name || "Walking Customer")}</div>
          ${cust.mobile ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;">Tel: ${esc(cust.mobile)}</div>` : ""}
          ${cust.address ? `<div style="font-size:9px;color:#6b7280;">${esc(cust.address)}</div>` : ""}
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d1d5db;">
            <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#6b7280;">SALESMEN</div>
            <div style="font-size:9px;font-weight:bold;">${esc(salesmanName || "—")}</div>
            ${salesmanId ? `<div style="font-size:9px;color:#6b7280;">${esc(salesmanId)}</div>` : ""}
          </div>
        </td>
        <td style="width:40%;padding:12px;vertical-align:top;border-left:1px solid #e5e7eb;">
          <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#6b7280;margin-bottom:6px;">INVOICE DETAILS</div>
          <table style="width:100%;border-collapse:collapse;">
            ${totalRow("Date:", `${fmtDate(sale.date)}${sale.createdAt ? ` ${fmtTime(sale.createdAt)}` : ""}`)}
            ${totalRow("Sale Type:", esc(salesTypeLabel[sale.salesType] || sale.salesType))}
            ${totalRow("Sale Status:", esc(sale.invoiceStatus))}
            ${totalRow("Pay Status:", esc(sale.paymentStatus))}
          </table>
        </td>
        <td style="width:27%;padding:12px;vertical-align:middle;border-left:1px solid #e5e7eb;text-align:center;">
          <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#6b7280;margin-bottom:6px;">INVOICE NO</div>
          <div style="font-size:12px;font-weight:bold;letter-spacing:2px;">${esc(sale.invoiceNumber)}</div>
        </td>
      </tr>
    </table>

    <!-- Items -->
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr style="background:#6b7280;color:#ffffff;">
          <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:bold;">#</th>
          <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:bold;">PRODUCT DESCRIPTION</th>
          <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:bold;">QTY</th>
          <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:bold;">PRICE</th>
          <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:bold;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Payment + totals -->
    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;">
          <div style="border:1px solid #d1d5db;border-radius:2px;padding:8px 12px;">
            <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#4b5563;margin-bottom:6px;">PAYMENT</div>
            ${paymentLines}
            <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;color:#374151;border-top:1px dashed #9ca3af;margin-top:6px;padding-top:6px;">
              <span>Total Paid</span><span>${money(sale.paid)}</span>
            </div>
          </div>
          ${
            sale.remark
              ? `<div style="border:1px solid #e5e7eb;border-radius:2px;padding:12px;margin-top:12px;">
                   <div style="font-size:8px;font-weight:bold;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;">REMARKS &amp; NOTES</div>
                   <div style="font-size:9px;color:#4b5563;">${esc(sale.remark)}</div>
                 </div>`
              : ""
          }
        </td>
        <td style="width:50%;vertical-align:top;padding-left:12px;">
          <table style="width:100%;border-collapse:collapse;">
            ${totalRow("Subtotal", money(sale.total))}
            ${totalRow(`Discount (${sale.discountPercent || 0}%)`, `-${money(discountAmt)}`)}
            ${totalRow(`VAT (${sale.vatPercent || 0}%)`, money(vatAmt))}
            ${totalRow("Delivery", money(sale.deliveryCost))}
            ${totalRow("Labour", money(sale.labourCost))}
            ${totalRow("Less", `-${money(sale.lessTaka)}`)}
            ${totalRow("Customer Advance", `-${money(sale.customerAdvancePaymentAdjust)}`)}
          </table>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f3f4f6;padding:8px 10px;border-radius:2px;margin-top:6px;">
            <span style="font-size:11px;font-weight:bold;color:#374151;">Total</span>
            <span style="font-size:11px;font-weight:bold;color:#374151;">${money(sale.payable)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:6px;">
            ${totalRow("Paid", money(sale.paid))}
            ${sale.changes > 0 ? totalRow("Change", money(sale.changes)) : ""}
          </table>
          <div style="border-top:1px solid #d1d5db;margin-top:6px;padding-top:6px;">
            <table style="width:100%;border-collapse:collapse;">
              ${totalRow("Present Due", money(sale.presentDue))}
              ${totalRow("Previous Due", money(sale.previousDue))}
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #d1d5db;margin-top:6px;padding-top:6px;font-weight:bold;font-size:11px;">
            <span>Total Due</span><span>${money(sale.balance)}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:12px;text-align:center;">
      ${storeFooter ? `<div style="font-size:9px;font-weight:bold;">${storeFooter}</div>` : ""}
      <div style="font-size:8px;color:#9ca3af;margin-top:6px;">Powered By Smartsoft Innovation | 01999878862</div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildInvoiceHtml };
