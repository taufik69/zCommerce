// module-alias must be registered before any @/ imports
require("module-alias/register");
require("dotenv").config();

const { server } = require("./src/app");
const { dbConnect } = require("./src/database/db");
const { customError } = require("./src/lib/CustomError");

dbConnect()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    throw new customError("Startup error: " + err, 500);
  });
