class customError extends Error {
  /**
   * Create a new customError instance
   * @param {string} message - The error message
   * @param {number} statusCode - The HTTP status code
   */
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
