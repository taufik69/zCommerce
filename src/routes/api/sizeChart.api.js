const express = require("express");
const _ = express.Router();
const {
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const sizeChartController = require("../../controller/sizeChart.controller");

_.route("/create-sizechart");

module.exports = _;
