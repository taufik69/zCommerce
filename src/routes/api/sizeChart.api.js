const express = require("express");
const _ = express.Router();
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const validate = require("../../middleware/validate");
const {
  createSizeChartSchema,
  updateSizeChartSchema,
  fromTemplateSchema,
} = require("../../validation/sizeChart.validation");
const sizeChartController = require("../../controller/sizeChart.controller");

_.route("/create-sizechart").post(
  // authGuard,
  // authorize("size-chart", "add"),
  validate(createSizeChartSchema),
  sizeChartController.createSizeChart,
);

_.route("/get-sizechart").get(
  // authGuard,
  // authorize("size-chart", "view"),
  sizeChartController.getAllSizeChart,
);

_.route("/search-sizechart").get(
  // authGuard,
  // authorize("size-chart", "view"),
  sizeChartController.searchSizeChart,
);

_.route("/applicable").get(
  // authGuard,
  // authorize("size-chart", "view"),
  sizeChartController.getApplicableCharts,
);

_.route("/from-template").post(
  // authGuard,
  // authorize("size-chart", "add"),
  validate(fromTemplateSchema),
  sizeChartController.createFromTemplate,
);

_.route("/get-sizechart/:slug").get(
  // authGuard,
  // authorize("size-chart", "view"),
  sizeChartController.getSizeChartBySlug,
);

_.route("/update-sizechart/:slug").put(
  // authGuard,
  // authorize("size-chart", "update"),
  validate(updateSizeChartSchema),
  sizeChartController.updateSizeChart,
);

_.route("/update-sizechart/:slug/activate").put(
  // authGuard,
  // authorize("size-chart", "update"),
  sizeChartController.activateSizeChart,
);

_.route("/update-sizechart/:slug/deactivate").put(
  // authGuard,
  // authorize("size-chart", "update"),
  sizeChartController.deactivateSizeChart,
);

_.route("/delete-sizechart/:slug").delete(
  // authGuard,
  // authorize("size-chart", "delete"),
  sizeChartController.deleteSizeChart,
);

module.exports = _;
