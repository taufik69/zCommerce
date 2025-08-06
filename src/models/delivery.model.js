const mongoose = require("mongoose");
const { Schema } = mongoose;

const deliverySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  deliveryCharge: {
    type: Number,
    required: true,
  },
  description: String,
});

// Ensure unique delivery type names
deliverySchema.pre("save", async function (next) {
  const isExist = await this.constructor.findOne({ name: this.name });
  if (isExist && isExist._id.toString() !== this._id.toString()) {
    throw new Error("Delivery type with this name already exists");
  }
  next();
});
module.exports = mongoose.model("DeliveryCharge", deliverySchema);
