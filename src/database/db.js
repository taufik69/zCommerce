const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { dbConfig } = require("../constant/constant");
const dbConnect = async () => {
  try {
    const conn = await mongoose.connect(
      `${process.env.DATABASE_URL}/${dbConfig.databaseName}`
    );
    console.log(conn.connection.host, " database connected");
  } catch (error) {
    throw new customError("Database connection error", 500);
  }
};

module.exports = { dbConnect };
