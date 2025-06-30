const { string } = require("joi");
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const roleSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    name: { type: String, required: true, unique: true, default: "user" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// make a slug using name
roleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
roleSchema.pre("save", async function (next) {
  const existingRole = await this.constructor.findOne({ slug: this.slug });
  if (existingRole && existingRole._id.toString() !== this._id.toString()) {
    console.log(
      `Role with slug ${this.slug} or name ${this.name} already exists`
    );
    throw new customError(
      `Role with slug ${this.slug} or name ${this.name} already exists`
    );
  }
  next();
});
module.exports = mongoose.model("Role", roleSchema);
