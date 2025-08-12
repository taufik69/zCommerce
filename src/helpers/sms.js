require("dotenv").config(); // .env লোড করার জন্য
const axios = require("axios");

async function sendSMS(numbers, message) {
  const BULK_SMS_API_KEY = process.env.BULK_SMS_API_KEY;
  const BULK_SMS_SENDER_ID = process.env.BULK_SMS_SENDER_ID;
  const BULK_SMS_URL = process.env.BULK_SMS_URL;

  try {
    if (!BULK_SMS_API_KEY || !BULK_SMS_SENDER_ID || !BULK_SMS_URL) {
      throw new Error("Missing required environment variables");
    }

    const numberList = Array.isArray(numbers) ? numbers.join(",") : numbers;

    const payload = {
      api_key: BULK_SMS_API_KEY,
      senderid: BULK_SMS_SENDER_ID,
      number: numberList,
      message: message,
    };

    const { data } = await axios.post(BULK_SMS_URL, payload);
    console.log("✅ SMS Sent Successfully:", data);
    return data;
  } catch (error) {
    console.error(
      "❌ Error sending SMS:",
      error.response?.data || error.message
    );
    throw error;
  }
}

module.exports = { sendSMS };
