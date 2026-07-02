const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");

const AUDIT_QUEUE_NAME = "audit-log";

const auditQueue = new Queue(AUDIT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 5000,
  },
});

module.exports = { auditQueue, AUDIT_QUEUE_NAME };
