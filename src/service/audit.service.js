const { auditQueue } = require("@/queues/audit.queue");

const REDACTED_FIELDS = new Set([
  "password",
  "refreshToken",
  "accessToken",
  "token",
  "otp",
  "resetPasswordToken",
  "twoFactorSecret",
  "cardNumber",
  "cvv",
]);

const SKIP_FIELDS = new Set(["__v", "updatedAt", "createdAt"]);

const MAX_SNAPSHOT_BYTES = 30 * 1024;

// Plain, redacted, JSON-safe copy of a mongoose doc or plain object
function sanitize(doc) {
  if (!doc) return undefined;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const clean = JSON.parse(
    JSON.stringify(obj, (key, value) =>
      REDACTED_FIELDS.has(key) ? "[REDACTED]" : value,
    ),
  );
  if (JSON.stringify(clean).length > MAX_SNAPSHOT_BYTES) {
    return { _truncated: true, _id: clean._id, name: clean.name };
  }
  return clean;
}

// Flat field-level diff over dot paths. Arrays are compared as whole values.
function computeDiff(before, after, prefix = "", out = [], depth = 0) {
  if (depth > 4) return out;
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const key of keys) {
    if (SKIP_FIELDS.has(key) || REDACTED_FIELDS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const b = before?.[key];
    const a = after?.[key];
    const bothObjects =
      b &&
      a &&
      typeof b === "object" &&
      typeof a === "object" &&
      !Array.isArray(b) &&
      !Array.isArray(a);
    if (bothObjects) {
      computeDiff(b, a, path, out, depth + 1);
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ field: path, before: b, after: a });
    }
  }
  return out;
}

/**
 * Fire-and-forget audit event — safe to call without await, never throws.
 *
 * logAudit({
 *   req,                    // express request (actor from req.user + ip/ua/path)
 *   user,                   // optional explicit actor (e.g. login, before req.user exists)
 *   action,                 // CREATE | UPDATE | DELETE | LOGIN | STATUS_CHANGE | ...
 *   entityType,             // "product", "order", "customer", ...
 *   entityId,
 *   entityLabel,            // human readable: invoiceId, product name, email
 *   before, after,          // docs or plain objects; diffed for UPDATE/STATUS_CHANGE
 * })
 */
async function logAudit({
  req,
  user,
  action,
  entityType,
  entityId,
  entityLabel,
  before,
  after,
}) {
  try {
    const actor = user || req?.user;
    const cleanBefore = sanitize(before);
    const cleanAfter = sanitize(after);

    const payload = {
      user: actor
        ? {
            id: actor._id?.toString(),
            name: actor.name || actor.fullName || "",
            email: actor.email || "",
            roles: (actor.roles || [])
              .map((r) => (typeof r === "string" ? r : r?.slug))
              .filter(Boolean),
          }
        : undefined,
      action,
      entity: {
        type: entityType,
        id: entityId?.toString(),
        label: entityLabel || "",
      },
      meta: req
        ? {
            ip: req.ip || "",
            userAgent: req.headers?.["user-agent"] || "",
            method: req.method || "",
            path: req.originalUrl || "",
            requestId: req.headers?.["x-request-id"] || "",
          }
        : undefined,
      createdAt: new Date().toISOString(),
    };

    if (action === "UPDATE" || action === "STATUS_CHANGE") {
      payload.changes = computeDiff(cleanBefore, cleanAfter);
      if (!payload.changes.length) return; // no-op update → no noise
    } else if (action === "CREATE") {
      payload.after = cleanAfter;
    } else if (action === "DELETE") {
      payload.before = cleanBefore;
    }

    await auditQueue.add("audit-event", payload);
  } catch (err) {
    // Audit must NEVER break the business flow
    console.error("[audit] failed to enqueue:", err.message);
  }
}

module.exports = { logAudit, computeDiff, sanitize };
