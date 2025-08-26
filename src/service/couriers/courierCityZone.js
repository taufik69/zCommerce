const { customError } = require("../../lib/CustomError");
const axios = require("axios");

class CityZone {
  constructor() {
    this.baseURL = "https://courier-api-sandbox.pathao.com/aladdin/api/v1";
    this.client_id = "7N1aMJQbWm";
    this.client_secret = "wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39";
    this.username = "test@pathao.com";
    this.password = "lovePathao";
  }

  async issueToken() {
    try {
      const payload = {
        client_id: this.client_id,
        client_secret: this.client_secret,
        grant_type: "password",
        username: this.username,
        password: this.password,
      };

      const response = await axios.post(`${this.baseURL}/issue-token`, payload);
      const { access_token, refresh_token, expires_in } = response.data;
      this.access_token = access_token;
      this.refresh_token = refresh_token;
      this.access_token_expiry = Date.now() + expires_in * 1000;
    } catch (err) {
      console.error(err.response?.data || err.message);
      throw new customError("Failed to issue Pathao token", 500);
    }
  }

  async refreshToken() {
    try {
      const payload = {
        client_id: this.client_id,
        client_secret: this.client_secret,
        grant_type: "refresh_token",
        refresh_token: this.refresh_token,
      };

      const response = await axios.post(`${this.baseURL}/issue-token`, payload);

      const { access_token, refresh_token, expires_in } = response.data;
      this.access_token = access_token;
      this.refresh_token = refresh_token;
      this.access_token_expiry = Date.now() + expires_in * 1000;
    } catch (err) {
      console.error(err.response?.data || err.message);
      throw new customError("Failed to refresh Pathao token", 500);
    }
  }

  async ensureToken() {
    if (!this.access_token) {
      await this.issueToken();
    } else if (Date.now() >= this.access_token_expiry) {
      await this.refreshToken();
    }
  }

  async getCities() {
    try {
      await this.ensureToken();
      console.log("Access Token:", this.access_token); // Debug log

      const response = await axios.get(`${this.baseURL}/city-list`, {
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });

      return response.data;
    } catch (err) {
      console.error(err.response?.data || err);
      throw new customError("Failed to fetch cities", 500);
    }
  }

  async getZones(cityId = 1) {
    try {
      await this.ensureToken();

      const response = await axios.get(
        `${this.baseURL}/cities/${cityId}/zone-list`,
        {
          headers: { Authorization: `Bearer ${this.access_token}` },
        }
      );

      return response.data;
    } catch (err) {
      console.error(err.response?.data || err.message);
      throw new customError("Failed to fetch zones", 500);
    }
  }
}

module.exports = CityZone;
