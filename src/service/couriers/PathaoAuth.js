require("dotenv").config();
const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const Merchant = require("../../models/marchant.model");

class PathaoAuth {
  constructor(merchant) {
    // API credentials
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.client_id = merchant.merchantID;
    this.client_secret = merchant.merchantSecret;
  }

  /** STEP 1: New token issue */
  async issueToken() {
    try {
      const payload =
        process.env.NODE_ENV === "production"
          ? {
              base_url: this.baseURL,
              client_id: this.client_id,
              client_secret: this.client_secret,
            }
          : {
              base_url: this.baseURL,
              client_id: this.client_id,
              client_secret: this.client_secret,
              username: "test@pathao.com",
              grant_type: "password",
              password: "lovePathao",
            };

      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.refresh_token = refresh_token;

      // Save token in DB
      const merchant = await Merchant.findOneAndUpdate(
        { merchantID: this.client_id },
        {
          access_token,
          refresh_token,
          token_expiry: Date.now() + expires_in * 1000,
        },
        { new: true }
      );
      if (!merchant) {
        throw new customError("Merchant not found", 404);
      }

      return access_token;
    } catch (err) {
      console.log(err);

      throw new customError(
        "Failed to issue Pathao token: " + err.message,
        500
      );
    }
  }

  /** STEP 2: Refresh token */
  async refreshToken() {
    try {
      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        {
          client_id: this.client_id,
          client_secret: this.client_secret,
          grant_type: "refresh_token",
          refresh_token: this.refresh_token,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.refresh_token = refresh_token;

      await Merchant.findOneAndUpdate(
        { merchantID: this.client_id },
        {
          access_token,
          refresh_token,
          token_expiry: Date.now() + expires_in * 1000,
        },
        { new: true }
      );

      return access_token;
    } catch (err) {
      console.log(err);
      throw new customError(
        "Failed to refresh Pathao token: " + err.message,
        500
      );
    }
  }

  /** STEP 3: Get valid token */
  async getValidToken() {
    const merchant = await Merchant.findOne({ merchantID: this.client_id });
    if (!merchant) throw new customError("Merchant not found", 404);

    // CASE 1: First time → issue new token
    if (!merchant.access_token || !merchant.refresh_token) {
      return await this.issueToken();
    }

    // CASE 2: Token expired → refresh
    if (Date.now() > merchant.token_expiry) {
      return await this.refreshToken();
    }

    // CASE 3: Token still valid
    return merchant.access_token;
  }
}

module.exports = PathaoAuth;
