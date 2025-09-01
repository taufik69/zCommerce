const express = require("express");
const _ = express.Router();
const {
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const sizeChartController = require("../../controller/sizeChart.controller");

_.route("/create-sizechart").post(
  // authGuard,
  // authorize("sizechart", "add"),
  multipleFileUploadWithFields([{ name: "image", maxCount: 3 }]),
  sizeChartController.createSizeChart
);

_.route("/get-sizechart").get(
  // authGuard,
  // authorize("sizechart", "view"),
  sizeChartController.getAllSizeChart
);

_.route("/get-sizechart/:slug").get(
  // authGuard,
  // authorize("sizechart", "view"),
  sizeChartController.getSizeChartBySlug
);

_.route("/update-sizechart/:slug").put(
  // authGuard,
  // authorize("sizechart", "update"),
  multipleFileUploadWithFields([{ name: "image", maxCount: 3 }]),
  sizeChartController.updateSizeChart
);

module.exports = _;
