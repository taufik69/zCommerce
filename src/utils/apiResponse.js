const apiResponse = class apiResponse {
  constructor(status, message, data) {
    this.status = status >= 200 && status < 300 ? "OK" : "error";
    this.statusCode = status || 500;
    this.message = message || "success";
    this.data = data;
  }
  static sendSuccess(res, status, message, data) {
    return res.status(status).json(new apiResponse(status, message, data));
  }
  static sendError(res, status, message, data = null) {
    return res.status(status).json(new apiResponse(status, message, data));
  }
};

module.exports = { apiResponse };
