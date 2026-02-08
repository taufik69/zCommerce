const dbConfig = {
  databaseName: "jahir",
};

// status code constant
const statusCodes = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

module.exports = { dbConfig, statusCodes };
