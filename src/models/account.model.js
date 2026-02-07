const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// make a slug using name
accountSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
accountSchema.pre("save", async function (next) {
  try {
    const existingAccount = await this.constructor.findOne({
      slug: this.slug,
      _id: { $ne: this._id },
    });

    if (existingAccount) {
      return next(
        new customError(`Account with slug '${this.slug}' already exists`, 400),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// when findOneAndUpdate query then again make slug
accountSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.Account || mongoose.model("Account", accountSchema);
