const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const Merchant = require("../../models/marchant.model");

class PathaoAuth {
  constructor(merchant) {
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.client_id = merchant.merchantID;
    this.client_secret = merchant.merchantSecret;
    this.username = merchant.merchantName;
    this.userPhone = merchant.merchantPhone;
    thus
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

      // make a new store
      const store = await axios.post(`${this.baseURL}/aladdin/api/v1/stores`, {
        name: "Demo Store",
        contact_name: "Test Merchant",
        contact_number: "017XXXXXXXX",
        address: "House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh",
        secondary_contact: "015XXXXXXXX",
        city_id: "",
        zone_id: "",
        area_id: "",
      });

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
