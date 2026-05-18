"use strict";

const cron = require("node-cron");
const fs = require("fs/promises");
const path = require("path");

const TEMP_DIR = path.resolve("public/temp");

async function cleanTempFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const toDelete = files.filter((f) => f !== ".gitkeep");

    await Promise.all(
      toDelete.map((f) =>
        fs.unlink(path.join(TEMP_DIR, f)).catch((err) =>
          console.error(`[TempClean] Failed to delete ${f}:`, err.message),
        ),
      ),
    );

    console.log(`[TempClean] Deleted ${toDelete.length} file(s) from public/temp`);
  } catch (err) {
    console.error("[TempClean] Error reading temp dir:", err.message);
  }
}

// Every day at 6:00 PM (18:00) server time
function scheduleTempCleanup() {
  cron.schedule("0 18 * * *", cleanTempFiles, {
    timezone: "Asia/Dhaka",
  });
  console.log("[TempClean] Scheduler registered — runs daily at 6:00 PM (Dhaka)");
}

module.exports = { scheduleTempCleanup };
