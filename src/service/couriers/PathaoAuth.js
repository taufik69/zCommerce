const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const Merchant = require("../../models/marchant.model");

class PathaoAuth {
  constructor(merchant) {
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.client_id = merchant.merchantID;
    this.client_secret = merchant.merchantSecret;
    this.username = merchant.merchantName;
    this.password = merchant.password;
    this.refresh_token = merchant.refresh_token; // DB থেকে আসবে
  }

  async issueToken() {
    try {
      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        {
          client_id: this.client_id,
          client_secret: this.client_secret,
          grant_type: "password",
          username: this.username,
          password: this.password,
        }
      );

      // make a new store for issuing token

      await Merchant.findOneAndUpdate(
        { merchantID: this.client_id },
        {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_expiry: Date.now() + response.data.expires_in * 1000,
        },
        { new: true }
      );

      return response.data.access_token;
    } catch (err) {
      throw new customError(
        "Failed to issue Pathao token: " + err.message,
        500
      );
    }
  }

  async refreshToken() {
    try {
      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        {
          client_id: this.client_id,
          client_secret: this.client_secret,
          grant_type: "refresh_token",
          refresh_token: this.refresh_token,
        }
      );

      await Merchant.findOneAndUpdate(
        { client_id: this.client_id },
        {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_expiry: Date.now() + response.data.expires_in * 1000,
        },
        { new: true }
      );

      return response.data.access_token;
    } catch (err) {
      throw new customError(
        "Failed to refresh Pathao token: " + err.message,
        500
      );
    }
  }

  async getValidToken() {
    const merchant = await Merchant.findOne({ merchantID: this.client_id });
    if (!merchant) throw new customError("Merchant not found", 404);

    // CASE 1: একদম নতুন, DB তে token নাই → নতুন করে issueToken()
    if (!merchant.access_token || !merchant.refresh_token) {
      return await this.issueToken();
    }

    // CASE 2: access token expired → refresh
    if (Date.now() > merchant.token_expiry) {
      return await this.refreshToken(merchant.refresh_token);
    }

    // CASE 3: এখনো valid
    return merchant.access_token;
  }
}
module.exports = PathaoAuth;
