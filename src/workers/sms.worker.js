"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const { SMS_QUEUE_NAME } = require("@/queues/sms.queue");
const { connection } = require("@/config/redis.config");
const { sendSMS } = require("@/helpers/sms");
const SmsLog = require("@/models/smsLog.model");
const { dbConnect } = require("@/database/db");
const { getIO } = require("@/socket/socket");

dbConnect()
  .then(() => {
    console.log("✅ SMS Worker DB connected");
    startSmsWorker();
  })
  .catch((err) => {
    console.error("❌ SMS Worker DB connection failed:", err.message);
    process.exit(1);
  });

function startSmsWorker() {
  const worker = new Worker(
    SMS_QUEUE_NAME,
    async (job) => {
      const { logId, recipients, message } = job.data;

      await SmsLog.updateOne({ _id: logId }, { $set: { status: "processing" } });

      let sentCount = 0;
      let failedCount = 0;

      // Send to all recipients in parallel batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (recipient) => {
            try {
              await sendSMS(recipient.phone, message);
              await SmsLog.updateOne(
                { _id: logId, "recipients.customerId": recipient.customerId },
                {
                  $set: {
                    "recipients.$.status": "sent",
                    "recipients.$.error": "",
                  },
                  $inc: { sentCount: 1 },
                },
              );
              sentCount++;
            } catch (err) {
              await SmsLog.updateOne(
                { _id: logId, "recipients.customerId": recipient.customerId },
                {
                  $set: {
                    "recipients.$.status": "failed",
                    "recipients.$.error": err.message || "Send failed",
                  },
                  $inc: { failedCount: 1 },
                },
              );
              failedCount++;
            }
          }),
        );
      }

      const finalStatus =
        failedCount === 0
          ? "completed"
          : sentCount === 0
            ? "failed"
            : "partial";

      await SmsLog.updateOne(
        { _id: logId },
        {
          $set: {
            status: finalStatus,
            sentCount,
            failedCount,
          },
        },
      );

      // Notify connected admin via Socket.IO
      try {
        const io = getIO();
        io.emit("sms:bulk:done", {
          logId,
          status: finalStatus,
          sentCount,
          failedCount,
          total: recipients.length,
        });
      } catch (_) {
        // Socket not initialized — non-fatal
      }

      return { logId, sentCount, failedCount, status: finalStatus };
    },
    { connection, concurrency: 2 },
  );

  worker.on("ready", () => console.log("✅ SMS Worker ready"));
  worker.on("active", (job) =>
    console.log(`▶️  SMS Job active [${job.id}]`),
  );
  worker.on("completed", (job, result) =>
    console.log(`✅ SMS Job completed [${job.id}] — sent:${result.sentCount} failed:${result.failedCount}`),
  );
  worker.on("failed", (job, err) =>
    console.error(`❌ SMS Job failed [${job?.id}]:`, err.message),
  );
  worker.on("error", (err) => console.error("🔥 SMS Worker error:", err));
}
