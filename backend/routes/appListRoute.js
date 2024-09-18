const express = require("express");
const router = express.Router();

//importing app_list controller methods
const { getAppList } = require("../controllers/appListController");

router.route("/appList").get(getAppList);

module.exports = router;
