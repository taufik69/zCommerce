const { server } = require("./src/app");
require("dotenv").config();
const { dbConnect } = require("./src/database/db");
const { customError } = require("./src/lib/CustomError");

dbConnect()
  .then(() => {
    const PORT = process.env.PORT || 3000;

    // just server.listen()
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    throw new customError(
      "Database connection error from index.js " + err,
      500
    );
  });
