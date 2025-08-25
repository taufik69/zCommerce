const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const Merchant = require("../../models/marchant.model");

class PathaoAuth {
  constructor(merchant) {
    // API credentials
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.client_id = merchant.merchantID;
    this.client_secret = merchant.merchantSecret;
    this.username = merchant.merchantName;
    this.password = merchant.password;

    // Store info
    this.storeName = merchant.storeName || "Demo Store";
    this.contact_name = merchant.merchantName;
    this.contact_number = merchant.merchantPhone;
    this.address = merchant.merchantAddress;
    this.secondary_contact = merchant.merchantsecondary_contact;
    this.city_id = merchant.merchantcity_id;
    this.zone_id = merchant.merchantzone_id;
    this.area_id = merchant.merchantarea_id;
  }

  /** STEP 1: New token issue */
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

      const { access_token, refresh_token, expires_in } = response.data;

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

      if (!merchant) throw new customError("Merchant not found", 404);

      // If no store, create one
      if (!merchant.store_id) {
        const store = await axios.post(
          `${this.baseURL}/aladdin/api/v1/stores`,
          {
            name: this.storeName, // "My Demo Store"
            contact_name: this.contact_name, // merchant.merchantName
            contact_number: this.contact_number, // phone
            address: this.address, // must add!
            secondary_contact: this.secondary_contact,
            city_id: Number(this.city_id), // ensure integer
            zone_id: Number(this.zone_id), // ensure integer
            area_id: Number(this.area_id), // ensure integer
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${response.data.access_token}`,
            },
          }
        );

        const store_id = storeRes.data.data.id;
        console.log("store_id", store_id);

        await Merchant.findOneAndUpdate(
          { merchantID: this.client_id },
          { store_id },
          { new: true }
        );
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
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

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

    await this.issueToken();
    return;

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
