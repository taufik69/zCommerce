"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const fs = require("fs/promises");
const { IMAGE_QUEUE_NAME } = require("@/queues/image.queue");
const { connection } = require("@/config/redis.config");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("@/helpers/cloudinary");
const categoryModel = require("@/models/category.model");
const { bumpNsVersion } = require("@/utils/cache.util");
const { dbConnect } = require("@/database/db");

dbConnect()
  .then(() => {
    console.log("✅ Worker DB connected");
    startImageWorker();
  })
  .catch((err) => {
    console.error("❌ Worker DB connection failed:", err.message);
    process.exit(1);
  });

function startImageWorker() {
  const worker = new Worker(
    IMAGE_QUEUE_NAME,
    async (job) => {
      const { categoryId, localPath, oldPublicId } = job.data;

      // Mark as processing so frontend knows upload is in progress
      await categoryModel.findByIdAndUpdate(categoryId, {
        "image.status": "processing",
        "image.localPath": localPath,
        "image.tries": job.attemptsMade,
      });

      try {
        // deleteAfter: false — worker manages file lifecycle across retries
        const uploaded = await cloudinaryFileUpload(localPath, {
          deleteAfter: false,
        });

        if (!uploaded) {
          throw new Error("Cloudinary upload returned null — file missing or upload failed");
        }

        // Update DB with final image data
        await categoryModel.findByIdAndUpdate(categoryId, {
          "image.url": uploaded.optimizeUrl,
          "image.publicId": uploaded.result.public_id,
          "image.status": "uploaded",
          "image.localPath": "",
          "image.tries": job.attemptsMade + 1,
          "image.lastError": "",
        });

        // Delete old Cloudinary image (update case) — non-blocking, non-critical
        if (oldPublicId) {
          deleteCloudinaryFile(oldPublicId).catch((e) =>
            console.error("[Worker] Old image delete failed:", e.message),
          );
        }

        // Cleanup local temp file
        await fs.unlink(localPath).catch(() => {});

        // Invalidate category cache — clients will re-fetch with new image URL
        await bumpNsVersion("category");

        return { categoryId, imageUrl: uploaded.optimizeUrl };
      } catch (err) {
        await categoryModel.findByIdAndUpdate(categoryId, {
          "image.status": "failed",
          "image.tries": job.attemptsMade + 1,
          "image.lastError": err?.message || "Upload failed",
        });

        // Cleanup local file once max retries are exhausted
        if (job.attemptsMade >= 3) {
          await fs.unlink(localPath).catch(() => {});
        }

        // Re-throw so BullMQ retries according to defaultJobOptions
        throw err;
      }
    },
    { connection, concurrency: 3 },
  );

  worker.on("ready", () => console.log("✅ Image Worker ready"));
  worker.on("active", (job) =>
    console.log(`▶️  Job active  [${job.id}] ${job.name}`),
  );
  worker.on("completed", (job) =>
    console.log(`✅ Job completed [${job.id}]`),
  );
  worker.on("failed", (job, err) =>
    console.error(`❌ Job failed   [${job?.id}]:`, err.message),
  );
  worker.on("error", (err) =>
    console.error("🔥 Worker error:", err),
  );
}
