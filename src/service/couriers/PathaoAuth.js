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
              client_id: this.client_id,
              client_secret: this.client_secret,
            }
          : {
              client_id: this.client_id,
              client_secret: this.client_secret,
              grant_type: "password",
              username: "test@pathao.com",
              password: "lovePathao",
            };

      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        payload
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
        }
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

  // get city id
  async getCityId(cityName = "Dhaka") {
    try {
      const accessToken = await this.getValidToken();
      if (!accessToken) throw new customError("Pathao token not found", 404);

      const response = await axios.get(
        `${this.baseURL}/aladdin/api/v1/city-list`,
        // "https://courier-api-sandbox.pathao.com/aladdin/api/v1/city-list",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
        }
      );

      const cityList = response?.data?.data?.data;
      const city = cityList.find(
        (c) => c.city_name.toLowerCase() === cityName.toLowerCase()
      );
      if (!city) throw new customError("City not found in Pathao", 404);
      return city.city_id;
    } catch (err) {
      console.log(err);
      throw new customError("Failed to get city ID: " + err.message, 500);
    }
  }

  //get zone id
  async getZoneId(cityId, zoneName) {
    try {
      const accessToken = await this.getValidToken();
      if (!accessToken) throw new customError("Pathao token not found", 404);

      const response = await axios.get(
        `${this.baseURL}/aladdin/api/v1/cities/${cityId}/zone-list`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
        }
      );

      const zoneList = response?.data?.data?.data;
      console.log(zoneList);
      // const zone = zoneList.find(
      //   (z) => z.zone_name.toLowerCase() === zoneName.toLowerCase()
      // );
      // if (!zone) throw new customError("Zone not found in Pathao", 404);
      // return zone.zone_id;
    } catch (err) {
      console.log(err);
      throw new customError("Failed to get zone ID: " + err.message, 500);
    }
  }
}

module.exports = PathaoAuth;
