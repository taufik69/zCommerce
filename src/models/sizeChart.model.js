const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");

const sizeChartSchema = new mongoose.Schema(
  {
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
    },
    image: {},
  },
  { timestamps: true }
);

// check this slug already exist or not
sizeChartSchema.pre("save", async function (next) {
  const existingSizeChart = await this.constructor.findOne({
    slug: this.subCategory,
  });
  if (
    existingSizeChart &&
    existingSizeChart._id.toString() !== this._id.toString()
  ) {
    console.log(
      `SizeChart with slug ${this.slug} or name ${this.name} already exists`
    );
    throw new customError(
      `SizeChart with slug ${this.slug} or name ${this.name} already exists`,
      400
    );
  }
  next();
});

module.exports =
  mongoose.models.SizeChart || mongoose.model("SizeChart", sizeChartSchema);
