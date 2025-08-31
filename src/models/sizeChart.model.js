const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const sizeChartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// make a slug using name
sizeChartSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
sizeChartSchema.pre("save", async function (next) {
  const existingSizeChart = await this.constructor.findOne({ slug: this.slug });
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
