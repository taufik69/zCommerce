class customError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status =
      statusCode >= 400 && statusCode < 500 ? "Client Error " : "server error";
    this.isOperationalError = true;
    this.data = null;
    Error.captureStackTrace(this, customError);
  }
}

module.exports = { customError };
