const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const dbConnect = async () => {
  try {
    const conn = await mongoose.connect("mongodb://localhost:27017/jahir");
    console.log(conn.connection.host, " database connected");
  } catch (error) {
    throw new customError("Database connection error", 500);
  }
};

module.exports = { dbConnect };
