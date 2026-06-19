const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const StoreInformation = require("../models/storeInformation.model");
const {
  validateStoreInformation,
  validateUpdateStoreInformation,
} = require("../validation/storeInformation.validation");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

const NS = "storeinformation";
const CACHE_TTL = 60 * 60;

// @desc  Create store information
exports.createStoreInformation = asynchandeler(async (req, res) => {
  const { image, ...fields } = await validateStoreInformation(req);

  const store = await StoreInformation.create({
    ...fields,
    image: {
      status: "pending",
      localPath: image.path,
    },
  });

  await imageQueue.add("create-storeinformation-image", {
    modelName: "storeinformation",
    documentId: store._id,
    localPath: image.path,
  });

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Store information created successfully",
    { storeName: store.storeName, slug: store.slug },
  );
});

// @desc  Get all store information (server-side pagination + search)
exports.getAllStoreInformation = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const search = (req.query.search || "").trim();
  const skip = (page - 1) * limit;

  const cacheKey = await buildCacheKey(NS, `all:p${page}:l${limit}:s${search}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Store information fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const filter = search
    ? {
        $or: [
          { storeName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { adress: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const [stores, total] = await Promise.all([
    StoreInformation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StoreInformation.countDocuments(filter),
  ]);

  if (!stores.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Store information not found", {
      stores: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      fromCache: false,
    });
  }

  const payload = {
    stores,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store information fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc  Get single store information by slug
exports.getSingleStoreInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Store information fetched successfully",
      { store: cached, fromCache: true },
    );
  }

  const store = await StoreInformation.findOne({ slug }).lean();
  if (!store) {
    throw new customError("Store information not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, store, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store information fetched successfully",
    { store, fromCache: false },
  );
});

// @desc  Update store information by slug
exports.updateStoreInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const store = await StoreInformation.findOne({ slug });
  if (!store) {
    throw new customError("Store information not found", statusCodes.NOT_FOUND);
  }

  const fields = await validateUpdateStoreInformation(req);

  const updatableFields = [
    "storeName",
    "propiterSlogan",
    "adress",
    "phone",
    "email",
    "businessHours",
    "footer",
    "facebookLink",
    "youtubeLink",
    "instagramLink",
    "whatsappLink",
    "twitterLink",
    "messengerLink",
    "linkedinLink",
    "googleMapLink",
    "qrCode",
  ];

  updatableFields.forEach((field) => {
    if (fields[field] !== undefined) store[field] = fields[field];
  });

  if (req.file) {
    const oldPublicId = store.image?.publicId || null;
    store.image.status = "pending";
    store.image.localPath = req.file.path;
    store.image.tries = 0;
    store.image.lastError = "";

    await imageQueue.add("update-storeinformation-image", {
      modelName: "storeinformation",
      documentId: store._id,
      localPath: req.file.path,
      oldPublicId,
    });
  }

  const updated = await store.save();
  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store information updated successfully",
    updated,
  );
});

// @desc  Delete store information by slug
exports.deleteStoreInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const store = await StoreInformation.findOneAndDelete({ slug });
  if (!store) {
    throw new customError("Store information not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  const publicId = store.image?.publicId;
  if (publicId) {
    setImmediate(() =>
      deleteCloudinaryFile(publicId).catch((e) =>
        console.error("[Cloudinary] StoreInformation image delete failed:", e.message),
      ),
    );
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store information deleted successfully",
    { slug },
  );
});

// @desc  Activate store information
exports.activateStoreInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const store = await StoreInformation.findOneAndUpdate(
    { slug, isActive: false },
    { isActive: true },
    { new: true },
  );

  if (!store) {
    throw new customError(
      "Store information not found or already active",
      statusCodes.NOT_FOUND,
    );
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Store activated successfully", store);
});

// @desc  Deactivate store information
exports.deactivateStoreInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const store = await StoreInformation.findOneAndUpdate(
    { slug, isActive: true },
    { isActive: false },
    { new: true },
  );

  if (!store) {
    throw new customError(
      "Store information not found or already inactive",
      statusCodes.NOT_FOUND,
    );
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store deactivated successfully",
    store,
  );
});

// @desc  Search store information
exports.searchStoreInformation = asynchandeler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    throw new customError("Search query is required", statusCodes.BAD_REQUEST);
  }

  const searchQuery = q.trim();
  const cacheKey = await buildCacheKey(NS, `search:${searchQuery}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Store information search results",
      { stores: cached, fromCache: true },
    );
  }

  const stores = await StoreInformation.find({
    $or: [
      { storeName: { $regex: searchQuery, $options: "i" } },
      { phone: { $regex: searchQuery, $options: "i" } },
      { email: { $regex: searchQuery, $options: "i" } },
      { adress: { $regex: searchQuery, $options: "i" } },
    ],
  })
    .lean()
    .sort({ storeName: 1 });

  if (!stores.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No store information found", {
      stores: [],
      fromCache: false,
    });
  }

  await setCache(cacheKey, stores, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Store information search results",
    { stores, fromCache: false },
  );
});
