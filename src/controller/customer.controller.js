const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  customerModel,
  customerPaymentRecived,
  customerAdvancePaymentModel,
  CustomerType,
} = require("../models/customer.model");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const {
  customerListDTO,
  customerPaymentDetailsDTO,
  customerPaymentListDTO,
  customerAdvancePaymentListDTO,
  customerAdvancePaymentDetailsDTO,
} = require("../dtos/all.dto");
const { statusCodes } = require("../constant/constant");
const { default: mongoose } = require("mongoose");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("../utils/cache.util");
const { imageQueue } = require("../queues/image.queue");

// ─── constants ────────────────────────────────────────────────────────────────
const NS_CUSTOMER = "customer";
const NS_CUSTOMER_TYPE = "customerType";
const NS_CUSTOMER_PAYMENT = "customerPayment";
const NS_CUSTOMER_ADVANCE = "customerAdvance";
const CACHE_TTL = 60 * 60; // 1 hour

// @desc crate CustomerType document
// @route POST /api/customers/create-customertype
// @access Private
exports.createCustomerType = asynchandeler(async (req, res) => {
  if (!req.body.customerType) {
    throw new customError(
      "Customer Type name is required",
      statusCodes.BAD_REQUEST,
    );
  }
  const customerType = await CustomerType.create(req.body);
  if (!customerType) {
    throw new customError(
      "Customer Type creation failed",
      statusCodes.SERVER_ERROR,
    );
  }

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER_TYPE);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Customer Type created successfully",
    customerType,
  );
});

// @desc get all customers
// @route GET /api/customers/get-customers
// @access Private
exports.getAllCustomersTypes = asynchandeler(async (req, res) => {
  let { slug } = req.query;
  if (slug) {
    const cacheKey = await buildCacheKey(NS_CUSTOMER_TYPE, `slug:${slug}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Customer fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const customer = await CustomerType.findOne({ slug });
    if (!customer) {
      throw new customError("Customer not found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, customer, CACHE_TTL);

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer fetched successfully",
      customer,
    );
    return;
  }

  const cacheKey = await buildCacheKey(NS_CUSTOMER_TYPE, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customers fetched successfully",
      { customers: cached, fromCache: true },
    );
  }

  const customers = await CustomerType.find().sort({ createdAt: -1 });
  if (!customers || customers.length === 0) {
    throw new customError("No customer found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, customers, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customers fetched successfully",
    customers,
  );
});

//@desc update customerType
// @route PUT /api/customers/update-customertype/:customerTypeId
// @access Private
exports.updateCustomerType = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const customerType = await CustomerType.findOneAndUpdate({ slug }, req.body, {
    new: true,
  });
  if (!customerType) {
    throw new customError("Customer Type not found", statusCodes.NOT_FOUND);
  }

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER_TYPE);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer Type updated successfully",
    customerType,
  );
});

// @desc delete customerType
// @route DELETE /api/customers/delete-customertype/:customerTypeId
// @access Private
exports.deleteCustomerType = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const customerType = await CustomerType.findOneAndDelete({ slug });
  if (!customerType) {
    throw new customError("Customer Type not found", statusCodes.NOT_FOUND);
  }

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER_TYPE);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer Type deleted successfully",
    customerType,
  );
});

// @desc create a new customer
// @route POST /api/customers/create-customer
// @access Private
exports.createCustomer = asynchandeler(async (req, res) => {
  const { image: imageFile, ...rest } = req.body;

  // Create customer immediately with pending image status
  const customer = await customerModel.create({
    ...rest,
    image: imageFile
      ? {
          status: "pending",
          localPath: imageFile.path,
        }
      : undefined,
  });

  if (!customer) {
    throw new customError("Customer creation failed", statusCodes.SERVER_ERROR);
  }

  // Enqueue image upload if provided
  if (imageFile) {
    await imageQueue.add("create-customer-image", {
      modelName: NS_CUSTOMER,
      documentId: customer._id,
      localPath: imageFile.path,
    });
  }

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Customer created successfully",
    customer.fullName,
  );
});

// @desc get all customer or get single customer with query parmas using customer id
// @route GET /api/customers
// @access Private
exports.getAllCustomers = asynchandeler(async (req, res) => {
  const { customerId, customerType, q } = req.query;

  // Build cache key based on query params
  const cacheParams = { customerId, customerType, q };
  const cacheKey = await buildCacheKey(
    NS_CUSTOMER,
    `query:${JSON.stringify(cacheParams)}`,
  );

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customers retrieved successfully",
      { ...cached, fromCache: true },
    );
  }

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

  const customers = await customerModel
    .find(query)
    .sort({ createdAt: -1 })
    .populate("customerType")
    .sort({ createdAt: -1 });

  if (!customers || customers.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Customers not found",
    );
  }

  const dto = customerListDTO(customers);
  await setCache(cacheKey, dto, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customers retrieved successfully",
    dto,
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
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Customer not found",
    );
  }

  // 2) Prevent forbidden updates
  delete req.body.customerId;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.deletedAt;

  const { image: imageFile, ...rest } = req.body;

  // 3) Handle image update via queue
  if (imageFile && imageFile.path) {
    const oldPublicId = customer.image?.publicId || null;

    // Set status to pending while worker uploads
    customer.image = {
      status: "pending",
      localPath: imageFile.path,
    };

    await imageQueue.add("update-customer-image", {
      modelName: NS_CUSTOMER,
      documentId: customer._id,
      localPath: imageFile.path,
      oldPublicId,
    });
  }

  // 4) Update other fields
  Object.assign(customer, rest);
  const updatedCustomer = await customer.save();

  // 5) Send response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer updated successfully",
    updatedCustomer,
  );

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER);
});

// delete customer
exports.deleteCustomer = asynchandeler(async (req, res) => {
  const { customerId } = req.params;
  const customer = await customerModel.findOneAndDelete({ customerId });
  if (!customer) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Customer not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer deleted successfully",
    customer,
  );

  // Invalidate cache
  await bumpNsVersion(NS_CUSTOMER);
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

// customer payment recived controller
exports.createCustomerPaymentRecived = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const customerid = req.body.customer;

    const paidAmount = Number(req.body.paidAmount || 0);
    const lessAmount = Number(req.body.lessAmount || 0);
    const cashBack = Number(req.body.cashBack || 0);
    const totalReduce = paidAmount + lessAmount + cashBack;

    if (!customerid) {
      throw new customError("Customer id is required", statusCodes.BAD_REQUEST);
    }
    if (totalReduce < 0) {
      throw new customError(
        "Paid amount must be greater than 0",
        statusCodes.BAD_REQUEST,
      );
    }

    let paymentDoc;

    await session.withTransaction(async () => {
      // 1) customer read (locked in txn snapshot)
      const customer = await customerModel
        .findById(customerid)
        .session(session);
      if (!customer)
        throw new customError("Customer not found", statusCodes.NOT_FOUND);

      const currentDue = Number(customer.openingDues || 0);
      if (totalReduce > currentDue) {
        throw new customError(
          `Opening due not enough. Current: ${currentDue}`,
          statusCodes.BAD_REQUEST,
        );
      }

      // 2) payment accumulate (single doc per customer)
      paymentDoc = await customerPaymentRecived.findOneAndUpdate(
        { customer: customerid },
        {
          $inc: { paidAmount, lessAmount, cashBack },
          $set: {
            paymentMode: req.body.paymentMode,
            remarks: req.body.remarks,
            date: req.body.date,
            referenceInvoice: req.body.referenceInvoice,
          },
        },
        { new: true, upsert: true, runValidators: true, session },
      );

      //  due reduce
      customer.openingDues = currentDue - totalReduce;
      await customer.save({ session });
    });

    session.endSession();

    apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Customer payment received successfully",
      customerPaymentDetailsDTO(paymentDoc),
    );

    // Invalidate cache
    await bumpNsVersion(NS_CUSTOMER_PAYMENT);
    await bumpNsVersion(NS_CUSTOMER); // Due might change
  } catch (err) {
    session.endSession();
    throw err; // asyncHandler -> global middleware asyncHandler -> global error middleware
  }
});

// @desc Get customer payments
// @route GET /api/get-customer-payment-reviced
// @query ?slug=rahim-ahmed
// @query ?name=rahim
exports.getCustomerPaymentReviced = asynchandeler(async (req, res) => {
  const { customer } = req.query;

  const cacheKey = await buildCacheKey(
    NS_CUSTOMER_PAYMENT,
    customer ? `customer:${customer}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment retrieved successfully",
      { ...cached, fromCache: true },
    );
  }

  // 1) Get single by slug
  if (customer) {
    const doc = await customerPaymentRecived
      .findOne({
        customer,
        isActive: true,
      })
      .populate("customer paymentMode")
      .sort({ createdAt: -1 });

    if (!doc) {
      return apiResponse.sendError(
        res,
        statusCodes.NOT_FOUND,
        "Customer payment not found",
      );
    }

    await setCache(cacheKey, doc, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment retrieved successfully",
      doc,
    );
  }

  // 2) Search by customer name (partial match)
  let query = {};

  const docs = await customerPaymentRecived
    .find(query)
    .sort({ createdAt: -1 })
    .populate("customer paymentMode")
    .sort({ createdAt: -1 });

  if (!docs || docs.length === 0) {
    apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "No customer payments found",
    );
  }

  await setCache(cacheKey, docs, CACHE_TTL);

  //  Return list
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer payments retrieved successfully",
    docs,
  );
});

// @desc update customer payment recived
//@route PUT /api/update-customer-payment-reviced
//@param slug
exports.updateCustomerPaymentRecived = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { customer } = req.params;

    let updatedDoc;

    await session.withTransaction(async () => {
      // 1) existing payment doc read (inside txn)
      const existing = await customerPaymentRecived
        .findOne({ customer })
        .session(session);

      if (!existing) {
        throw new customError(
          "Customer payment not found",
          statusCodes.NOT_FOUND,
        );
      }

      // 2) customer read
      const customerDoc = await customerModel
        .findById(customer)
        .session(session);
      if (!customerDoc) {
        throw new customError("Customer not found", statusCodes.NOT_FOUND);
      }

      // old totals
      const oldPaid = Number(existing.paidAmount || 0);
      const oldLess = Number(existing.lessAmount || 0);
      const oldCashBack = Number(existing.cashBack || 0);
      const oldTotal = oldPaid + oldLess + oldCashBack;

      // new totals (if field not provided, keep old)
      const newPaid =
        req.body.paidAmount !== undefined
          ? Number(req.body.paidAmount || 0)
          : oldPaid;
      const newLess =
        req.body.lessAmount !== undefined
          ? Number(req.body.lessAmount || 0)
          : oldLess;
      const newCashBack =
        req.body.cashBack !== undefined
          ? Number(req.body.cashBack || 0)
          : oldCashBack;
      const newTotal = newPaid + newLess + newCashBack;

      // 3) delta: positive হলে due কমবে, negative হলে due বাড়বে
      const delta = newTotal - oldTotal;

      // due check only when delta increases payment
      const currentDue = Number(customerDoc.openingDues || 0);
      if (delta > 0 && delta > currentDue) {
        throw new customError(
          `Opening due not enough. Current: ${currentDue}`,
          statusCodes.BAD_REQUEST,
        );
      }

      // 4) update payment doc (set exact values)
      updatedDoc = await customerPaymentRecived.findOneAndUpdate(
        { customer },
        {
          $set: {
            ...req.body, // paymentMode, remarks, date, referenceInvoice etc.
            paidAmount: newPaid,
            lessAmount: newLess,
            cashBack: newCashBack,
          },
        },
        { new: true, runValidators: true, session },
      );

      // 5) adjust customer due by delta
      // delta > 0 => due কমবে, delta < 0 => due বাড়বে
      customerDoc.openingDues = currentDue - delta;
      await customerDoc.save({ session });
    });

    session.endSession();

    // Invalidate cache
    await bumpNsVersion(NS_CUSTOMER_PAYMENT);
    await bumpNsVersion(NS_CUSTOMER);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment updated successfully",
      customerPaymentDetailsDTO(updatedDoc),
    );
  } catch (err) {
    session.endSession();
    throw err;
  }
});

// @desc delete  customer payment recived
//@route DELETE /api/delete-customer-payment-reviced
//@param slug
exports.deleteCustomerPaymentRecived = asynchandeler(async (req, res) => {
  const { customer } = req.params;
  const paymentRecived = await customerPaymentRecived.findOneAndDelete({
    customer,
  });
  if (!paymentRecived) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Customer payment not found",
    );
  }
    // Invalidate cache
    await bumpNsVersion(NS_CUSTOMER_PAYMENT);
    await bumpNsVersion(NS_CUSTOMER);

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment deleted successfully",
      customerPaymentDetailsDTO(paymentRecived),
    );
});

// customerAdvancePayment controlle
exports.createCustomerAdvancePaymentRecived = asynchandeler(
  async (req, res) => {
    const customerId = req.body.customer;

    const paidInput = Number(req.body.paidAmount || 0);
    const cashBackInput = Number(req.body.advanceCashBack || 0);

    if (!customerId) {
      return apiResponse.sendError(
        res,
        statusCodes.BAD_REQUEST,
        "Customer is required",
      );
    }

    // existing doc
    const existing = await customerAdvancePaymentModel.findOne({
      customer: customerId,
    });

    const oldPaid = existing?.paidAmount || 0;
    const oldCashBack = existing?.advanceCashBack || 0;
    const oldBalance = existing?.balance || 0;

    // prevent extra cashback
    if (cashBackInput > oldBalance) {
      return apiResponse.sendError(
        res,
        statusCodes.BAD_REQUEST,
        `Advance balance not enough. Current: ${oldBalance}`,
      );
    }

    // new totals
    let newPaid = oldPaid + paidInput;
    let newCashBack = oldCashBack + cashBackInput;
    let newBalance = newPaid - newCashBack;

    //  Reset rule
    if (newBalance === 0) {
      newPaid = 0;
      newCashBack = 0;
    }

    const doc = await customerAdvancePaymentModel.findOneAndUpdate(
      { customer: customerId },
      {
        $set: {
          paidAmount: newPaid,
          advanceCashBack: newCashBack,
          balance: newBalance,
          paymentMode: req.body.paymentMode,
          date: req.body.date,
          remarks: req.body.remarks,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    // Invalidate cache
    await bumpNsVersion(NS_CUSTOMER_ADVANCE);

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Customer advance payment updated successfully",
      customerAdvancePaymentDetailsDTO(doc),
    );
  },
);

// @desc Get customer payments
// @route GET /api/get-customer-advance-payment-reviced
// @query ?slug=rahim-ahmed
// @query ?name=rahim
exports.getCustomerAdvancePaymentReviced = asynchandeler(async (req, res) => {
  const { customer } = req.query;

  const cacheKey = await buildCacheKey(
    NS_CUSTOMER_ADVANCE,
    customer ? `customer:${customer}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment retrieved successfully",
      { ...cached, fromCache: true },
    );
  }

  //  Get single by slug
  if (customer) {
    const doc = await customerAdvancePaymentModel
      .findOne({
        customer,
        isActive: true,
      })
      .populate("customer paymentMode")
      .sort({ createdAt: -1 });

    if (!doc) {
      return apiResponse.sendError(
        res,
        statusCodes.NOT_FOUND,
        "Customer payment not found",
      );
    }

    await setCache(cacheKey, doc, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment retrieved successfully",
      doc,
    );
  }

  // 2) Search by customer name (partial match)
  let query = {};

  const docs = await customerAdvancePaymentModel
    .find(query)
    .sort({ createdAt: -1 })
    .populate("customer paymentMode")
    .sort({ createdAt: -1 });

  if (!docs || docs.length === 0) {
    apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "No customer payments found",
    );
  }

  await setCache(cacheKey, docs, CACHE_TTL);

  //  Return list
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer payments retrieved successfully",
    docs,
  );
});

// @desc delete  customer payment recived
//@route DELETE /api/delete-customer-payment-reviced
//@param slug
exports.deleteCustomerAdvancePaymentRecived = asynchandeler(
  async (req, res) => {
    const { customer } = req.params;
    const paymentRecived = await customerAdvancePaymentModel.findOneAndDelete({
      customer,
    });
    if (!paymentRecived) {
      return apiResponse.sendError(
        res,
        statusCodes.NOT_FOUND,
        "Customer payment not found",
      );
    }
    // Invalidate cache
    await bumpNsVersion(NS_CUSTOMER_ADVANCE);

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment deleted successfully",
      customerAdvancePaymentDetailsDTO(paymentRecived),
    );
  },
);
