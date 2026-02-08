const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const sizeChartSchema = new mongoose.Schema(
  {
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
    },
    image: {},
  },
  { timestamps: true },
);

// check this slug already exist or not
sizeChartSchema.pre("save", async function (next) {
  try {
    const existingSizeChart = await this.constructor.findOne({
      slug: this.subCategory,
    });
    if (
      existingSizeChart &&
      existingSizeChart._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          `SizeChart with slug ${this.slug} or name ${this.name} already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.SizeChart || mongoose.model("SizeChart", sizeChartSchema);
