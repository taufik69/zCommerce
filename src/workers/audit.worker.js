"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const { AUDIT_QUEUE_NAME } = require("@/queues/audit.queue");
const { connection } = require("@/config/redis.config");
const { auditLogModel } = require("@/models/auditLog.model");
const { dbConnect } = require("@/database/db");

dbConnect()
  .then(() => {
    console.log("✅ Audit worker DB connected");
    startAuditWorker();
  })
  .catch((err) => {
    console.error("❌ Audit worker DB connection failed:", err.message);
    process.exit(1);
  });

function startAuditWorker() {
  const worker = new Worker(
    AUDIT_QUEUE_NAME,
    async (job) => {
      // insert via native driver — bypasses the immutability pre-hooks
      // and skips schema re-validation on a payload the service already shaped
      await auditLogModel.collection.insertOne({
        ...job.data,
        createdAt: job.data.createdAt ? new Date(job.data.createdAt) : new Date(),
        ...(job.data.user?.id && {
          user: { ...job.data.user, id: toObjectId(job.data.user.id) },
        }),
        ...(job.data.entity?.id && {
          entity: { ...job.data.entity, id: toObjectId(job.data.entity.id) },
        }),
      });
      return { logged: true };
    },
    { connection, concurrency: 25 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[audit.worker] job ${job?.id} failed:`, err.message);
  });

  worker.on("ready", () => {
    console.log("🚀 Audit worker is ready and listening for jobs...");
  });
}

function toObjectId(id) {
  const mongoose = require("mongoose");
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
}
