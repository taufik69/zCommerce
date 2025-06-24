const { app } = require("./src/app");
require("dotenv").config();
const { dbConnect } = require("./src/database/db");
const { customError } = require("./src/lib/CustomError");
dbConnect()
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(
        "Server is running on port http://localhost:" + process.env.PORT
      );
    });
  })
  .catch((err) => {
    throw new customError("Database connection error from index.js" + err, 500);
  });
