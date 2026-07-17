"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const { EMAIL_QUEUE_NAME } = require("@/queues/email.queue");
const { connection } = require("@/config/redis.config");
const { sendEmail } = require("@/helpers/nodemailer");
const { dbConnect } = require("@/database/db");

dbConnect()
  .then(() => {
    console.log("✅ Email Worker DB connected");
    startEmailWorker();
  })
  .catch((err) => {
    console.error("❌ Email Worker DB connection failed:", err.message);
    process.exit(1);
  });

function startEmailWorker() {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { to, subject, html } = job.data;
      if (!to) {
        // Nothing to send — treat as a no-op success so the job doesn't retry.
        return { skipped: true, reason: "no recipient" };
      }
      const messageId = await sendEmail(to, subject, html);
      return { to, messageId: messageId || null };
    },
    { connection, concurrency: 3 },
  );

  worker.on("ready", () => console.log("✅ Email Worker ready"));
  worker.on("active", (job) => console.log(`▶️  Email Job active [${job.id}]`));
  worker.on("completed", (job, result) =>
    console.log(`✅ Email Job completed [${job.id}] — to:${result?.to || "-"}`),
  );
  worker.on("failed", (job, err) =>
    console.error(`❌ Email Job failed [${job?.id}]:`, err.message),
  );
  worker.on("error", (err) => console.error("🔥 Email Worker error:", err));
}
