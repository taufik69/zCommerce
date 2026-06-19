const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");

const SMS_QUEUE_NAME = "due-sms";

const smsQueue = new Queue(SMS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

module.exports = { smsQueue, SMS_QUEUE_NAME };
