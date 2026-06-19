const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const SiteInformation = require("../models/siteInformation.model");
const { validateSiteInformation } = require("../validation/siteinformation.validation");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

const NS = "siteinformation";
const CACHE_TTL = 60 * 60;

// @desc  Create site information
exports.createSiteInformation = asynchandeler(async (req, res) => {
  const { image, ...fields } = await validateSiteInformation(req);

  const site = await SiteInformation.create({
    ...fields,
    image: {
      status: "pending",
      localPath: image.path,
    },
  });

  await imageQueue.add("create-siteinformation-image", {
    modelName: "siteinformation",
    documentId: site._id,
    localPath: image.path,
  });

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Site information created successfully",
    { storeName: site.storeName, slug: site.slug },
  );
});

// @desc  Get all site information
exports.getAllSiteInformation = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Site information fetched successfully", cached);
  }

  const sites = await SiteInformation.find().sort({ createdAt: -1 }).lean();

  if (!sites.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Site information not found", []);
  }

  await setCache(cacheKey, sites, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Site information fetched successfully",
    sites,
  );
});

// @desc  Get single site information by slug
exports.getSingleSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Site information fetched successfully",
      { site: cached, fromCache: true },
    );
  }

  const site = await SiteInformation.findOne({ slug }).lean();
  if (!site) {
    throw new customError("Site information not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, site, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Site information fetched successfully",
    { site, fromCache: false },
  );
});

// @desc  Update site information by slug
exports.updateSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const site = await SiteInformation.findOne({ slug });
  if (!site) {
    throw new customError("Site information not found", statusCodes.NOT_FOUND);
  }

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
    if (req.body[field] !== undefined) site[field] = req.body[field];
  });

  if (req.file) {
    const oldPublicId = site.image?.publicId || null;
    site.image.status = "pending";
    site.image.localPath = req.file.path;
    site.image.tries = 0;
    site.image.lastError = "";

    await imageQueue.add("update-siteinformation-image", {
      modelName: "siteinformation",
      documentId: site._id,
      localPath: req.file.path,
      oldPublicId,
    });
  }

  const updated = await site.save();
  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Site information updated successfully",
    updated,
  );
});

// @desc  Delete site information by slug
exports.deleteSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const site = await SiteInformation.findOneAndDelete({ slug });
  if (!site) {
    throw new customError("Site information not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  const publicId = site.image?.publicId;
  if (publicId) {
    setImmediate(() =>
      deleteCloudinaryFile(publicId).catch((e) =>
        console.error("[Cloudinary] SiteInformation image delete failed:", e.message),
      ),
    );
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Site information deleted successfully",
    { slug },
  );
});
