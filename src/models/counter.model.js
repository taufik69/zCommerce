const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true, // EMPLOYEE, ORDER, INVOICE etc
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);
