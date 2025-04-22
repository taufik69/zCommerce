const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    stockVariant: {
      type: Number,
      required: true,
      min: 0,
    },
    variantBasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// check size and color already have database after save the data
variantSchema.pre("save", async (next) => {
  const isExistSizeColor = await this.constructor.find({
    size: this.size,
    color: this.color,
  });

  if (
    isExistSizeColor &&
    isExistSizeColor._id.toString() !== this._id.toString()
  ) {
    console.log(`Already Have this ${this.color} and ${this.size} `);
    throw new customError(`Already Have this ${this.color} and ${this.size} `);
  }
});

const Variant = mongoose.model("Variant", variantSchema);

module.exports = Variant;
