const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
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
  try {
    const isExist = await this.constructor.findOne({ name: this.name });
    if (isExist && isExist._id.toString() !== this._id.toString()) {
      return next(
        new customError("Delivery type with this name already exists", 400),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Delivery =
  mongoose.models.Delivery || mongoose.model("Delivery", deliverySchema);
module.exports = Delivery;
