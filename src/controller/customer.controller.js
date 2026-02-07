const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customerModel } = require("../models/customer.model");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { customerListDTO } = require("../dtos/all.dto");

// @desc create a new customer
// @route POST /api/customers/create-customer
// @access Private
exports.createCustomer = asynchandeler(async (req, res) => {
  // Create customer immediately
  const customer = await customerModel.create({
    ...req.body,
    image: null,
  });

  // Send Immediate Response (client won't wait for upload)
  apiResponse.sendSuccess(
    res,
    202,
    "Customer creation started. Processing image in background...",
    customer.fullName,
  );

  //  Background upload + update
  (async () => {
    try {
      // if no file, nothing to upload
      if (!req?.body?.image?.path) {
        console.log("ℹ Customer created without image:", customer.fullName);
        return;
      }

      const { optimizeUrl } = await cloudinaryFileUpload(
        req?.body?.image?.path,
      );

      await customerModel.findByIdAndUpdate(
        customer._id,
        { image: optimizeUrl },
        { new: true },
      );

      console.log("✅ Customer Created (BG Task):", customer.fullName);
    } catch (error) {
      console.error("❌ Background Customer Creation Failed:", error.message);
      await customerModel.findByIdAndUpdate(customer._id, { image: null });
    }
  })();
});

// @desc get all customer or get single customer with query parmas using customer id
// @route GET /api/customers
// @access Private
exports.getAllCustomers = asynchandeler(async (req, res) => {
  const { customerId, customerType, q } = req.query;

  const query = { isActive: true };

  // exact by customerId (highest priority)
  if (customerId) {
    query.customerId = customerId;
  }

  // filter by type
  if (customerType) {
    query.customerType = customerType;
  }

  // partial search by name OR phone (q = "rah" or "0171")
  if (q && q.trim()) {
    const search = q.trim();
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { mobileNumber: { $regex: search, $options: "i" } },
    ];
  }

  const customers = await customerModel.find(query).sort({ createdAt: -1 });

  if (!customers || customers.length === 0) {
    return apiResponse.sendError(res, 404, "Customers not found");
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Customers retrieved successfully",
    customerListDTO(customers),
  );
});

// @desc update a customer

// @desc Update Customer
// @route put /api/customers/:customerId

exports.updateCustomer = asynchandeler(async (req, res) => {
  const { customerId } = req.params;

  // 1) Find existing customer
  const customer = await customerModel.findOne({ customerId });

  if (!customer) {
    return apiResponse.sendError(res, 404, "Customer not found");
  }

  // 2) Prevent forbidden updates
  delete req.body.customerId;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.deletedAt;

  // 3) Handle image update (if new image comes)
  if (req.body.image && req.body.image.path) {
    // Upload new image first
    const { optimizeUrl } = await cloudinaryFileUpload(req.body.image.path);

    // Delete old image (if exists)
    if (customer.image) {
      try {
        const parts = customer.image.split("/");
        const publicId = parts[parts.length - 1].split("?")[0];
        if (publicId) {
          await deleteCloudinaryFile(publicId);
        }
      } catch (err) {
        console.log("Old image delete failed:", err.message);
      }
    }

    // Replace with new image URL
    req.body.image = optimizeUrl;
  } else {
    // If no new image, don't overwrite existing image
    delete req.body.image;
  }

  // 4) Update customer
  const updatedCustomer = await customerModel.findByIdAndUpdate(
    customer._id,
    { $set: req.body },
    { new: true, runValidators: true },
  );

  // 5) Send response
  apiResponse.sendSuccess(
    res,
    200,
    "Customer updated successfully",
    updatedCustomer,
  );
});

// delete customer
exports.deleteCustomer = asynchandeler(async (req, res) => {
  const { customerId } = req.params;
  const customer = await customerModel.findOneAndDelete({ customerId });
  if (!customer) {
    return apiResponse.sendError(res, 404, "Customer not found");
  }
  apiResponse.sendSuccess(res, 200, "Customer deleted successfully", customer);
  // Delete  image from cludinary
  (async () => {
    try {
      const parts = customer.image.split("/");
      const publicId = parts[parts.length - 1].split("?")[0];
      if (publicId) {
        await deleteCloudinaryFile(publicId);
      }
    } catch (err) {
      console.log("Old image delete failed:", err.message);
    }
  })();
});
